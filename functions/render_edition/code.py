#input_type_name: RenderEditionInput
#output_type_name: RenderEditionResult
#function_name: render_edition

"""render_edition — deterministic renderer for the weekly Forgetful Times edition.

The editor agent never writes HTML (brief N3): it emits the JSON payload described
in the pod brief (§4d) and this function is the only thing that turns it into a
page. It validates the payload, picks or downgrades the layout, HTML-escapes every
string and restricts every link to http(s) (titles/deks/urls trace back to the open
web via `why`/`source_url` — untrusted), drops any item missing a required slot, and
writes /editions/<year>-W<week>.html.

The visual design lives in /templates/forgetful-times.html — this function reads
that file's <style> block verbatim and reuses its exact class names when building
the body, so the CSS is the single source of truth for how the paper looks.
"""

import html
import re
from datetime import date

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

TEMPLATE_PATH = "/templates/forgetful-times.html"
EDITIONS_FOLDER = "/editions"

TITLE_MAX = 200
DEK_MAX = 400
BYLINE_MAX = 150
NAME_MAX = 60

# The Editorial tab embeds this page in a sandboxed iframe (no top navigation
# allowed) — every outbound link needs its own tab or it can never be followed.
# Harmless when the file is opened directly too (e.g. from Telegram).
LINK_ATTRS = 'target="_blank" rel="noopener noreferrer"'


# ---------- input / output models (brief §4d — source_kind is the only seam) ----------

class EditionMeta(BaseModel):
    volume: str
    date: str            # ISO date, e.g. "2026-08-23"
    week_label: str
    filed_count: int


class HeroItem(BaseModel):
    source_kind: str
    source_id: str
    kicker: str | None = None
    title: str | None = None
    dek: str | None = None
    byline: str | None = None
    image_url: str | None = None
    href: str | None = None


class RailItem(BaseModel):
    source_kind: str
    source_id: str
    mark: str | None = None
    title: str | None = None
    href: str | None = None


class SectionItem(BaseModel):
    source_kind: str
    source_id: str
    type: str = "card"    # "card" | "thought"
    title: str | None = None
    dek: str | None = None
    byline: str | None = None
    href: str | None = None
    image_url: str | None = None


class Section(BaseModel):
    id: str
    name: str
    items: list[SectionItem] = []


class OpinionItem(BaseModel):
    source_kind: str
    source_id: str
    text: str | None = None
    byline: str | None = None


class RenderEditionInput(BaseModel):
    edition: EditionMeta
    layout: str = "lede"          # lede | no-photo | bulletin — a request, not a guarantee
    hero: HeroItem | None = None
    rail: list[RailItem] = []
    sections: list[Section] = []
    opinion: OpinionItem | None = None


class RenderEditionResult(BaseModel):
    ok: bool
    path: str | None = None
    layout_used: str | None = None
    item_count: int = 0
    dropped: list[str] = []
    error: str | None = None


# ---------- small helpers ----------

def esc(value: str | None) -> str:
    return html.escape(value or "", quote=True)


def clip(value: str | None, limit: int) -> str | None:
    """Trim, cap length, and collapse a falsy/whitespace-only value to None so
    callers can just test truthiness instead of re-checking for blank strings."""
    if not value:
        return None
    value = value.strip()
    if not value:
        return None
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"


def safe_url(value: str | None) -> str:
    """Only http(s) survives. Everything else (javascript:, data:, empty, garbage)
    becomes "" — hrefs/images trace back to fetched web content, so this is the
    guardrail against a stray scheme riding along into rendered HTML."""
    value = (value or "").strip()
    return value if value.startswith(("http://", "https://")) else ""


def fmt_long_date(d: date) -> str:
    return d.strftime("%A, %B ") + str(d.day) + d.strftime(", %Y")


def fmt_short_date(d: date) -> str:
    return d.strftime("%b ") + str(d.day) + d.strftime(", %Y")


def iso_week_path(d: date) -> str:
    iso_cal = d.isocalendar()
    return f"{EDITIONS_FOLDER}/{iso_cal.year}-W{iso_cal.week:02d}.html"


# ---------- validation / dropping (brief §4c: "drop items missing a required slot") ----------

def valid_hero(hero: HeroItem | None, dropped: list[str]) -> HeroItem | None:
    if hero is None:
        return None
    if not clip(hero.title, TITLE_MAX) or not safe_url(hero.href):
        dropped.append(f"hero:{hero.source_id} missing title/href")
        return None
    return hero


def valid_rail(items: list[RailItem], dropped: list[str]) -> list[RailItem]:
    out = []
    for item in items:
        if not clip(item.title, TITLE_MAX) or not safe_url(item.href):
            dropped.append(f"rail:{item.source_id} missing title/href")
            continue
        out.append(item)
        if len(out) == 2:  # brief §4e: rail is up to 2 — the renderer caps it too
            break
    return out


def valid_section_item(item: SectionItem, dropped: list[str]) -> bool:
    if not clip(item.title, TITLE_MAX):
        dropped.append(f"{item.type}:{item.source_id} missing title")
        return False
    if item.type == "card" and not safe_url(item.href):
        dropped.append(f"card:{item.source_id} missing href")
        return False
    return True


def valid_sections(sections: list[Section], dropped: list[str]) -> list[Section]:
    out = []
    for section in sections:
        if not clip(section.id, 60) or not clip(section.name, NAME_MAX):
            dropped.append(f"section:{section.id or '?'} missing id/name")
            continue
        items = [item for item in section.items if valid_section_item(item, dropped)]
        if items:
            out.append(Section(id=section.id, name=section.name, items=items))
    return out


def valid_opinion(opinion: OpinionItem | None, dropped: list[str]) -> OpinionItem | None:
    if opinion is None:
        return None
    if not clip(opinion.text, DEK_MAX):
        dropped.append(f"opinion:{opinion.source_id} missing text")
        return None
    return opinion


# ---------- HTML fragment builders (class names match /templates/forgetful-times.html) ----------

def build_lede(hero: HeroItem, no_photo: bool) -> str:
    kicker = esc(clip(hero.kicker, 40) or "Filed")
    title = esc(clip(hero.title, TITLE_MAX))
    dek = clip(hero.dek, DEK_MAX)
    byline = clip(hero.byline, BYLINE_MAX)
    href = esc(safe_url(hero.href))
    dek_html = f'<p class="dek">{esc(dek)}</p>' if dek else ""
    byline_html = f'<p class="byline">{esc(byline)}</p>' if byline else ""
    if no_photo:
        return (
            '<section class="lede no-photo">'
            '<hr class="hairline" />'
            f'<a href="{href}" {LINK_ATTRS}>'
            f'<p class="kicker">{kicker}</p>'
            f'<h2 class="lede-title">{title}</h2>'
            f"{dek_html}{byline_html}"
            "</a></section>"
        )
    image = esc(safe_url(hero.image_url))
    return (
        '<section class="lede">'
        f'<a href="{href}" {LINK_ATTRS}>'
        '<div class="lede-frame">'
        f'<img class="lede-photo" src="{image}" alt="{title}" />'
        "</div>"
        f'<p class="kicker">{kicker}</p>'
        f'<h2 class="lede-title">{title}</h2>'
        f"{dek_html}{byline_html}"
        "</a></section>"
    )


def rail_mark(item: RailItem) -> str:
    mark = clip(item.mark, 6)
    if mark:
        return mark
    words = (clip(item.title, TITLE_MAX) or "").split()
    return words[0][:5].upper() if words else "•"


def build_rail(items: list[RailItem]) -> str:
    if not items:
        return ""
    rows = []
    for item in items:
        title = esc(clip(item.title, TITLE_MAX))
        href = esc(safe_url(item.href))
        mark = esc(rail_mark(item))
        rows.append(
            f'<a class="rail-item" href="{href}" {LINK_ATTRS}>'
            f'<div class="rail-mark">{mark}</div>'
            f"<div><h3>{title}</h3></div>"
            "</a>"
        )
    return (
        '<hr class="hairline pad" style="margin: 8px 16px 0;" />'
        f'<section class="rail">{"".join(rows)}</section>'
    )


def build_card(item: SectionItem) -> str:
    title = esc(clip(item.title, TITLE_MAX))
    href = esc(safe_url(item.href))
    dek = clip(item.dek, DEK_MAX)
    byline = clip(item.byline, BYLINE_MAX)
    image = safe_url(item.image_url)
    img_html = f'<img src="{esc(image)}" alt="{title}" />' if image else ""
    dek_html = f"<p>{esc(dek)}</p>" if dek else ""
    byline_html = f'<p class="meta">{esc(byline)}</p>' if byline else ""
    return f'<a class="card" href="{href}" {LINK_ATTRS}>{img_html}<h3>{title}</h3>{dek_html}{byline_html}</a>'


def build_thought(item: SectionItem, variant_index: int) -> str:
    variant = ["", " alt", " cream"][variant_index % 3]
    title = clip(item.title, TITLE_MAX) or "?"
    dek = clip(item.dek, DEK_MAX)
    byline = clip(item.byline, BYLINE_MAX)
    mark_letter = esc(title[:1].upper())
    dek_html = f"<p>{esc(dek)}</p>" if dek else ""
    byline_html = f'<p class="meta">{esc(byline)}</p>' if byline else ""
    return (
        f'<article class="card thought{variant}">'
        f'<div class="mark">{mark_letter}</div>'
        f"<h3>{esc(title)}</h3>{dek_html}{byline_html}</article>"
    )


def build_section(section: Section, thought_start_index: int) -> tuple[str, int]:
    parts = []
    thought_index = thought_start_index
    for item in section.items:
        if item.type == "card":
            parts.append(build_card(item))
        else:
            parts.append(build_thought(item, thought_index))
            thought_index += 1
    html_out = (
        f'<section class="section" id="{esc(clip(section.id, 60))}">'
        '<hr class="hairline" style="margin: 0 0 14px;" />'
        '<div class="section-head">'
        f"<h2>{esc(clip(section.name, NAME_MAX))}</h2>"
        '<span class="view-all">Filed »</span>'
        "</div>"
        f'<div class="grid-2">{"".join(parts)}</div>'
        "</section>"
    )
    return html_out, thought_index


def build_opinion(opinion: OpinionItem) -> str:
    text = esc(clip(opinion.text, DEK_MAX))
    byline = clip(opinion.byline, BYLINE_MAX)
    byline_html = f'<p class="byline">{esc(byline)}</p>' if byline else ""
    return f'<section class="opinion" id="opinion"><p class="kicker">Opinion</p><h2>{text}</h2>{byline_html}</section>'


def build_bulletin_item(title: str | None, dek: str | None, byline: str | None, href: str | None) -> str:
    title_text = esc(clip(title, TITLE_MAX) or "Untitled")
    dek_clean = clip(dek, DEK_MAX)
    byline_clean = clip(byline, BYLINE_MAX)
    dek_html = f"<p>{esc(dek_clean)}</p>" if dek_clean else ""
    byline_html = f'<p class="meta">{esc(byline_clean)}</p>' if byline_clean else ""
    inner = f"<h3>{title_text}</h3>{dek_html}{byline_html}"
    link = safe_url(href)
    if link:
        return f'<a class="bulletin-item" href="{esc(link)}" {LINK_ATTRS}>{inner}</a>'
    return f'<div class="bulletin-item">{inner}</div>'


def build_bulletin_list(rail: list[RailItem], sections: list[Section], opinion: OpinionItem | None) -> str:
    rows = [build_bulletin_item(item.title, None, None, item.href) for item in rail]
    for section in sections:
        for item in section.items:
            rows.append(build_bulletin_item(item.title, item.dek, item.byline, item.href))
    if opinion:
        rows.append(build_bulletin_item(opinion.text, None, opinion.byline, None))
    if not rows:
        rows = ['<div class="bulletin-item"><p>Nothing filed this week.</p></div>']
    return f'<div class="bulletin-list">{"".join(rows)}</div>'


def build_nav(sections: list[Section], has_opinion: bool) -> str:
    links = [f'<a href="#{esc(clip(s.id, 60))}">{esc(clip(s.name, NAME_MAX))}</a>' for s in sections]
    if has_opinion:
        links.append('<a href="#opinion">Opinion</a>')
    return "".join(links)


# ---------- assembly ----------

def _css_from_template(raw_html: str) -> str:
    match = re.search(r"<style>(.*?)</style>", raw_html, re.DOTALL)
    if not match:
        raise ValueError("template has no <style> block")
    return match.group(1)


def _ensure_editions_folder(pod: Pod) -> None:
    try:
        pod.files.create_folder(EDITIONS_FOLDER)
    except Exception:
        pass  # already exists — the only case this hits once the bundle's shipped


def _build_document(data: RenderEditionInput, css: str, dropped: list[str]) -> tuple[str, str, str, int]:
    edition_date = date.fromisoformat(data.edition.date)

    hero = valid_hero(data.hero, dropped)
    rail = valid_rail(data.rail, dropped)
    sections = valid_sections(data.sections, dropped)
    opinion = valid_opinion(data.opinion, dropped)

    section_item_count = sum(len(s.items) for s in sections)
    total_items = (1 if hero else 0) + len(rail) + section_item_count + (1 if opinion else 0)

    # The editor's layout is a request, not a guarantee (brief §4b) — the renderer
    # downgrades whenever the data doesn't support what was asked for.
    if total_items < 4:
        layout = "bulletin"
    elif data.layout == "lede" and not safe_url(hero.image_url if hero else None):
        layout = "no-photo"
    elif data.layout in ("lede", "no-photo", "bulletin"):
        layout = data.layout
    else:
        layout = "lede" if safe_url(hero.image_url if hero else None) else "no-photo"

    body_parts = []
    if hero:
        body_parts.append(build_lede(hero, no_photo=(layout != "lede")))

    if layout == "bulletin":
        body_parts.append(build_bulletin_list(rail, sections, opinion))
        nav_links = ""
    else:
        body_parts.append(build_rail(rail))
        thought_index = 0
        for section in sections:
            section_html, thought_index = build_section(section, thought_index)
            body_parts.append(section_html)
        if opinion:
            body_parts.append(build_opinion(opinion))
        nav_links = build_nav(sections, has_opinion=bool(opinion))

    if nav_links:
        header_nav = f'<hr class="hairline-double" /><nav>{nav_links}</nav><hr class="hairline" />'
    else:
        header_nav = '<hr class="hairline-double" />'

    masthead_date = fmt_long_date(edition_date)
    masthead_edition = f"Vol. {esc(data.edition.volume)}"
    folio_line = (
        f"Forgetful Times · Vol. {esc(data.edition.volume)} · "
        f"{data.edition.filed_count} filed · {fmt_short_date(edition_date)}"
    )

    document = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Forgetful Times — {esc(masthead_date)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Oswald:wght@500;600;700&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap" rel="stylesheet" />
  <style>{css}</style>
</head>
<body>
  <article class="edition">
    <header>
      <div class="topbar">
        <div class="menu" aria-hidden="true">☰</div>
        <div class="date">{esc(masthead_date)}</div>
        <div class="subscribe">{masthead_edition}</div>
      </div>
      <div class="tools">
        <div class="search" aria-hidden="true"></div>
        <div class="social" aria-hidden="true"><i></i><i></i><i></i></div>
      </div>
      <div class="masthead">
        <h1>Forgetful<br />Times</h1>
      </div>
      <p class="tagline">Things you meant to remember · est. 2026</p>
      {header_nav}
    </header>
    {"".join(body_parts)}
    <p class="folio">{folio_line}</p>
  </article>
</body>
</html>
"""
    return document, layout, iso_week_path(edition_date), total_items


async def render_edition(ctx: FunctionContext, data: RenderEditionInput) -> RenderEditionResult:
    pod = Pod.from_env()

    try:
        template_raw = pod.files.download(TEMPLATE_PATH).decode("utf-8")
        css = _css_from_template(template_raw)
    except Exception as exc:
        return RenderEditionResult(ok=False, error=f"could not load template: {exc}")

    dropped: list[str] = []
    try:
        document, layout, path, total_items = _build_document(data, css, dropped)
    except Exception as exc:
        return RenderEditionResult(ok=False, error=f"could not build edition: {exc}", dropped=dropped)

    try:
        _ensure_editions_folder(pod)
        pod.files.write_text(path, document)
    except Exception as exc:
        return RenderEditionResult(ok=False, error=f"could not write {path}: {exc}", dropped=dropped)

    return RenderEditionResult(ok=True, path=path, layout_used=layout, item_count=total_items, dropped=dropped)
