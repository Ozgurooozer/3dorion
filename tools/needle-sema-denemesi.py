# tools/needle-sema-denemesi.py — extract() icin DOGRU sema bicimini bul.
# Gecici tanilama; calisan bicim bulununca ana sondaya tasinir.
import time

from needle import extract, Field

BLOK = (
    r"PS C:\Users\ozigo> gti status" "\n"
    "gti : The term 'gti' is not recognized as the name of a cmdlet, function, script file,\n"
    "or operable program.\n"
    "    + FullyQualifiedErrorId : CommandNotFoundException"
)

SISTEM = "Extract the failed command from this terminal error block."


class TerminalError:
    """Structured info about a failed terminal command."""

    failed_command: str = Field(description="The command the user typed that failed")
    error_kind: str = Field(description="Short category, e.g. command-not-found")


def dene(ad, sema):
    t = time.time()
    try:
        r = extract(BLOK, sema, system=SISTEM, strict=False)
        print(f"{ad:28} {int((time.time() - t) * 1000):5d} ms -> {r}")
    except Exception as e:  # noqa: BLE001 - tanilama
        print(f"{ad:28} HATA {type(e).__name__}: {str(e)[:110]}")


dene("1) sinif + Field", TerminalError)

dene("2) dict: name/parameters", {
    "name": "terminal_error",
    "description": "Failed terminal command info",
    "parameters": {
        "type": "object",
        "properties": {
            "failed_command": {"type": "string", "description": "the command that failed"},
            "error_kind": {"type": "string", "description": "short error category"},
        },
        "required": ["failed_command"],
    },
})

dene("3) duz json-schema", {
    "type": "object",
    "properties": {
        "failed_command": {"type": "string", "description": "the command that failed"},
    },
    "required": ["failed_command"],
})
