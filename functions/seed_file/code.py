#input_type_name: SeedFileInput
#output_type_name: SeedFileResult
#function_name: seed_file

"""seed_file — bootstrap public playbooks and voice templates into the pod.

A small setup utility for portable pod assets. File contents do not travel in a
Lemma bundle, so scripts/bootstrap-files.sh calls this function after import.
Also used for one-off backfills (e.g. rewriting existing /notes/*.md files) —
pass `files` to write several in one slow server round trip instead of one per call.

Grants: folder.write on /playbook, /voices, /notes, /templates only. It cannot
write elsewhere. Not exposed to any agent — it is called from the CLI by a pod admin.
"""

from pathlib import PurePosixPath

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

ALLOWED_FOLDERS = {"playbook", "voices", "notes", "templates"}


class SeedFileItem(BaseModel):
    path: str          # e.g. "/playbook/answer.md"
    content: str


class SeedFileInput(BaseModel):
    # Single-file form (back-compat with scripts/bootstrap-files.sh).
    path: str | None = None
    content: str | None = None
    # Batch form — any number of files in one function run.
    files: list[SeedFileItem] | None = None


class SeedFileWrite(BaseModel):
    path: str
    bytes: int


class SeedFileResult(BaseModel):
    written: list[SeedFileWrite]


def _write_one(pod: Pod, path: str, content: str) -> SeedFileWrite:
    full_path = "/" + path.lstrip("/")
    parts = PurePosixPath(full_path).parts
    if len(parts) < 3 or parts[1] not in ALLOWED_FOLDERS:
        raise ValueError(f"path must be inside one of {sorted(ALLOWED_FOLDERS)}")
    pod.files.write_text(full_path, content)
    return SeedFileWrite(path=full_path, bytes=len(content.encode("utf-8")))


async def seed_file(ctx: FunctionContext, data: SeedFileInput) -> SeedFileResult:
    items = list(data.files or [])
    if data.path is not None:
        items.append(SeedFileItem(path=data.path, content=data.content or ""))
    if not items:
        raise ValueError("provide either path+content, or files[]")
    pod = Pod.from_env()
    written = [_write_one(pod, item.path, item.content) for item in items]
    return SeedFileResult(written=written)
