"""Text extraction preserving page numbers. Never executes uploaded content."""
import io


def extract_text(file_bytes, file_type):
    """Returns list of (page_number, text). Raises ValueError on corrupt/empty input."""
    pages = []
    if file_type == "txt":
        text = file_bytes.decode("utf-8", errors="strict")
        pages = [(1, text)]
    elif file_type == "pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        for i, page in enumerate(reader.pages, start=1):
            pages.append((i, page.extract_text() or ""))
    elif file_type == "docx":
        from docx import Document as DocxDoc
        doc = DocxDoc(io.BytesIO(file_bytes))
        text = "\n".join(p.text for p in doc.paragraphs)
        pages = [(1, text)]
    else:
        raise ValueError(f"Unsupported file type: {file_type}")
    if not any(t.strip() for _, t in pages):
        raise ValueError("Document contains no extractable text (empty or unreadable).")
    return pages

def detect_type(filename, content_type=""):
    name = filename.lower()
    if name.endswith(".pdf"): return "pdf"
    if name.endswith(".docx"): return "docx"
    if name.endswith(".txt"): return "txt"
    return None

MAGIC = {"pdf": b"%PDF", "docx": b"PK"}
def validate_magic(file_bytes, file_type):
    if file_type in MAGIC and not file_bytes.startswith(MAGIC[file_type]):
        raise ValueError("File contents do not match its extension.")
    if file_type == "txt":
        try: file_bytes[:4096].decode("utf-8")
        except UnicodeDecodeError: raise ValueError("TXT file is not valid UTF-8 text.")
