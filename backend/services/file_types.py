TEXT_FILE_EXTENSIONS = [".txt", ".md", ".html", ".htm", ".rtf"]
OFFICE_FILE_EXTENSIONS = [".pdf", ".docx", ".doc", ".pptx", ".ppt"]
TABLE_FILE_EXTENSIONS = [".csv", ".tsv", ".xlsx", ".xls"]
STRUCTURED_FILE_EXTENSIONS = [".json", ".xml", ".yaml", ".yml"]
IMAGE_FILE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"]
CODE_FILE_EXTENSIONS = [".py", ".js", ".ts", ".java", ".go"]
LOG_FILE_EXTENSIONS = [".log", ".srt", ".vtt"]

SUPPORTED_FILE_EXTENSIONS = (
    TEXT_FILE_EXTENSIONS
    + OFFICE_FILE_EXTENSIONS
    + TABLE_FILE_EXTENSIONS
    + STRUCTURED_FILE_EXTENSIONS
    + IMAGE_FILE_EXTENSIONS
    + CODE_FILE_EXTENSIONS
    + LOG_FILE_EXTENSIONS
)

SUPPORTED_FILE_EXTENSION_SET = set(SUPPORTED_FILE_EXTENSIONS)

