#input_type_name: SeedFileInput
#output_type_name: SeedFileResult
#function_name: seed_file

"""seed_file — bootstrap public playbooks and voice templates into the pod.

A small setup utility for portable pod assets. File contents do not travel in a
Lemma bundle, so scripts/bootstrap-files.sh calls this function after import.

Grants: folder.write on /playbook, /voices, /notes only. It cannot write elsewhere.
Not exposed to any agent — it is called from the CLI by a pod admin.
"""

from pathlib import PurePosixPath

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod


class SeedFileInput(BaseModel):
    path: str          # e.g. "/playbook/answer.md"
    content: str


class SeedFileResult(BaseModel):
    path: str
    bytes: int


async def seed_file(ctx: FunctionContext, data: SeedFileInput) -> SeedFileResult:
    path = "/" + data.path.lstrip("/")
    parts = PurePosixPath(path).parts
    if len(parts) < 3 or parts[1] not in {"playbook", "voices", "notes"}:
        raise ValueError("path must be inside /playbook, /voices, or /notes")
    pod = Pod.from_env()
    pod.files.write_text(path, data.content)
    return SeedFileResult(path=path, bytes=len(data.content.encode("utf-8")))
