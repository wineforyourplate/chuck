#input_type_name: FetchUrlInput
#output_type_name: FetchUrlResult
#function_name: fetch_url

"""fetch_url — the one deterministic action Chuck's curator leans on.

Given any URL, detect what it is and pull back clean, readable content:
  - x.com / twitter.com  → the tweet text + author, via the public FxTwitter API
  - github.com/<o>/<r>   → repo description + README
  - youtube / youtu.be   → title + channel, via oEmbed (no transcript in v1)
  - everything else      → fetch HTML, extract the article with Readability

No API keys, no auth. Always returns a result object; on failure `ok=False` and
`error` is set (so the curator can still file the bare link and flag it).
"""

import ipaddress
import re
import socket
from html.parser import HTMLParser
from urllib.parse import parse_qs, urljoin, urlparse, quote

import requests  # pre-installed
from pydantic import BaseModel

from lemma_sdk import FunctionContext

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
TIMEOUT = 12
MAX_TEXT = 8000
MAX_REDIRECTS = 5


class FetchUrlInput(BaseModel):
    url: str


class FetchUrlResult(BaseModel):
    ok: bool
    kind: str          # article | tweet | repo | video | other
    title: str = ""
    text: str = ""     # extracted, readable content (truncated to ~8k chars)
    author: str = ""
    site: str = ""     # host, e.g. "stripe.com"
    image_url: str = ""  # public OpenGraph/media thumbnail when the source exposes one
    url: str = ""
    error: str = ""


def _clip(s: str, n: int = MAX_TEXT) -> str:
    s = (s or "").strip()
    return s if len(s) <= n else s[:n].rstrip() + " …"


def _host(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower().lstrip("www.")
    except Exception:
        return ""


def _headers() -> dict:
    return {"User-Agent": UA, "Accept": "text/html,application/json;q=0.9,*/*;q=0.8"}


def _public_url(url: str) -> str:
    """Validate a URL before the server makes a request.

    This pod accepts user-supplied links, so localhost, private/link-local networks,
    credentials in URLs, and non-HTTP schemes must never reach `requests`.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("only http and https URLs are supported")
    if not parsed.hostname:
        raise ValueError("URL has no hostname")
    if parsed.username or parsed.password:
        raise ValueError("credentials in URLs are not supported")

    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        addresses = {
            item[4][0]
            for item in socket.getaddrinfo(parsed.hostname, port, type=socket.SOCK_STREAM)
        }
    except socket.gaierror as exc:
        raise ValueError("hostname could not be resolved") from exc

    if not addresses:
        raise ValueError("hostname could not be resolved")
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if not ip.is_global:
            raise ValueError("private or reserved network addresses are not allowed")
    return parsed.geturl()


def _safe_get(url: str, **kwargs):
    """GET a public URL while validating every redirect hop."""
    current = _public_url(url)
    for _ in range(MAX_REDIRECTS + 1):
        response = requests.get(
            current,
            headers=_headers(),
            timeout=TIMEOUT,
            allow_redirects=False,
            **kwargs,
        )
        if response.status_code not in (301, 302, 303, 307, 308):
            return response
        location = response.headers.get("location")
        if not location:
            return response
        current = _public_url(urljoin(current, location))
    raise ValueError("too many redirects")


class _ReadableHtml(HTMLParser):
    """Small dependency-free HTML extractor.

    It deliberately favors portability over perfect article extraction: script,
    style, navigation, form, and SVG content are dropped; headings/paragraphs become
    text boundaries; OpenGraph metadata is retained for reliable titles/bylines.
    """

    SKIP_TAGS = {"script", "style", "noscript", "svg", "nav", "form"}
    BREAK_TAGS = {
        "article", "aside", "blockquote", "br", "div", "figcaption", "footer",
        "h1", "h2", "h3", "h4", "h5", "h6", "header", "li", "main", "p",
        "section", "td", "th", "tr",
    }

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip_tag: str | None = None
        self.in_title = False
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self.meta: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs):
        tag = tag.lower()
        if self.skip_tag:
            return
        if tag in self.SKIP_TAGS:
            self.skip_tag = tag
            return
        values = {str(key).lower(): value or "" for key, value in attrs}
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            key = (values.get("property") or values.get("name") or "").lower()
            if key and values.get("content"):
                self.meta[key] = values["content"].strip()
        elif tag in self.BREAK_TAGS:
            self.text_parts.append("\n")

    def handle_endtag(self, tag: str):
        tag = tag.lower()
        if self.skip_tag:
            if tag == self.skip_tag:
                self.skip_tag = None
            return
        if tag == "title":
            self.in_title = False
        if tag in self.BREAK_TAGS:
            self.text_parts.append("\n")

    def handle_data(self, data: str):
        if self.skip_tag:
            return
        value = data.strip()
        if not value:
            return
        if self.in_title:
            self.title_parts.append(value)
        self.text_parts.append(value)

    @property
    def title(self) -> str:
        return " ".join(self.title_parts).strip()

    @property
    def text(self) -> str:
        text = " ".join(self.text_parts)
        text = re.sub(r"[ \t\f\v]+", " ", text)
        text = re.sub(r" *\n+ *", "\n", text)
        return text.strip()


def _fetch_tweet(url: str) -> FetchUrlResult:
    m = re.search(r"/status(?:es)?/(\d+)", url)
    if not m:
        return FetchUrlResult(ok=False, kind="tweet", url=url, site=_host(url),
                              error="could not find a tweet id in that link")
    tid = m.group(1)
    r = _safe_get(f"https://api.fxtwitter.com/status/{tid}")
    r.raise_for_status()
    tweet = (r.json() or {}).get("tweet") or {}
    if not tweet:
        return FetchUrlResult(ok=False, kind="tweet", url=url, site="x.com",
                              error="tweet not available (private, deleted, or rate-limited)")
    author = tweet.get("author") or {}
    name = author.get("name") or ""
    handle = author.get("screen_name") or ""
    who = f"{name} (@{handle})".strip() if name or handle else ""
    media = tweet.get("media") or {}
    photos = (media.get("photos") or []) if isinstance(media, dict) else []
    image_url = ""
    if photos and isinstance(photos[0], dict):
        candidate = photos[0].get("url") or ""
        if candidate:
            try:
                image_url = _public_url(candidate)
            except ValueError:
                image_url = ""
    return FetchUrlResult(
        ok=True, kind="tweet", url=url, site="x.com",
        title=_clip(tweet.get("text", ""), 120) or f"Tweet by {who}",
        text=_clip(tweet.get("text", "")),
        author=who,
        image_url=image_url,
    )


def _fetch_repo(url: str) -> FetchUrlResult:
    m = re.search(r"github\.com/([^/]+)/([^/#?]+)", url)
    if not m:
        return FetchUrlResult(ok=False, kind="repo", url=url, site="github.com",
                              error="could not parse owner/repo from that link")
    owner, repo = m.group(1), m.group(2).removesuffix(".git")
    meta = {}
    try:
        r = _safe_get(f"https://api.github.com/repos/{owner}/{repo}")
        if r.ok:
            meta = r.json() or {}
    except Exception:
        pass
    readme = ""
    for ref in ("HEAD", "main", "master"):
        try:
            rr = _safe_get(
                f"https://raw.githubusercontent.com/{owner}/{repo}/{ref}/README.md")
            if rr.ok and rr.text.strip():
                readme = rr.text
                break
        except Exception:
            continue
    desc = (meta.get("description") or "").strip()
    stars = meta.get("stargazers_count")
    lang = meta.get("language") or ""
    header = f"{owner}/{repo}"
    facts = " · ".join([x for x in [lang, (f"{stars}★" if stars is not None else "")] if x])
    body = "\n\n".join([x for x in [desc, (f"({facts})" if facts else ""), readme] if x])
    if not body:
        return FetchUrlResult(ok=False, kind="repo", url=url, site="github.com",
                              error="repo not found or has no README")
    return FetchUrlResult(
        ok=True, kind="repo", url=url, site="github.com",
        title=f"{header} — {desc}" if desc else header,
        text=_clip(body), author=owner,
        image_url=f"https://opengraph.githubassets.com/chuck/{owner}/{repo}",
    )


def _fetch_video(url: str) -> FetchUrlResult:
    try:
        oembed = f"https://www.youtube.com/oembed?url={quote(url, safe='')}&format=json"
        r = _safe_get(oembed)
        r.raise_for_status()
        data = r.json() or {}
        title = data.get("title") or ""
        author = data.get("author_name") or ""
        parsed = urlparse(url)
        video_id = (
            parsed.path.strip("/") if _host(url) == "youtu.be"
            else parse_qs(parsed.query).get("v", [""])[0]
        )
        if not video_id:
            match = re.search(r"/(?:shorts|embed)/([^/?]+)", parsed.path)
            video_id = match.group(1) if match else ""
        return FetchUrlResult(
            ok=True, kind="video", url=url, site=_host(url),
            title=title or "Video", author=author,
            text=_clip(f"{title}\nby {author}".strip()),
            image_url=(f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if video_id else ""),
        )
    except Exception as e:
        return FetchUrlResult(ok=False, kind="video", url=url, site=_host(url),
                              error=f"could not read video metadata: {e}")


def _fetch_article(url: str) -> FetchUrlResult:
    r = _safe_get(url)
    r.raise_for_status()
    parser = _ReadableHtml()
    try:
        parser.feed(r.text)
    except Exception:
        pass
    title = parser.meta.get("og:title") or parser.title
    author = parser.meta.get("article:author") or parser.meta.get("author") or ""
    image_url = parser.meta.get("og:image") or parser.meta.get("twitter:image") or ""
    if image_url:
        try:
            image_url = _public_url(urljoin(url, image_url))
        except ValueError:
            image_url = ""
    text = parser.text or parser.meta.get("og:description") or parser.meta.get("description") or ""
    if not text.strip():
        return FetchUrlResult(ok=False, kind="article", url=url, site=_host(url),
                              title=title, error="page had no extractable text (JS wall or paywall)")
    return FetchUrlResult(
        ok=True, kind="article", url=url, site=_host(url),
        title=title or _host(url), text=_clip(text), author=author, image_url=image_url,
    )


async def fetch_url(ctx: FunctionContext, data: FetchUrlInput) -> FetchUrlResult:
    url = (data.url or "").strip()
    if not url:
        return FetchUrlResult(ok=False, kind="other", url=url, error="no url given")
    if not re.match(r"^[a-z][a-z0-9+.-]*://", url, re.I):
        url = "https://" + url
    host = _host(url)
    try:
        if host in ("x.com", "twitter.com", "mobile.twitter.com", "fxtwitter.com"):
            return _fetch_tweet(url)
        if host in ("github.com", "www.github.com"):
            return _fetch_repo(url)
        if host in ("youtube.com", "m.youtube.com", "youtu.be"):
            return _fetch_video(url)
        return _fetch_article(url)
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else "?"
        return FetchUrlResult(ok=False, kind="other", url=url, site=host,
                              error=f"the site returned HTTP {code}")
    except requests.RequestException as e:
        return FetchUrlResult(ok=False, kind="other", url=url, site=host,
                              error=f"could not reach the site: {e}")
    except ValueError as e:
        return FetchUrlResult(ok=False, kind="other", url=url, site=host,
                              error=f"refused URL: {e}")
    except Exception as e:
        return FetchUrlResult(ok=False, kind="other", url=url, site=host,
                              error=f"unexpected error: {e}")
