export function getErrorMessage(detail: unknown, fallback: string) {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const joined = detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object") {
          const message = "msg" in item ? item.msg : null;
          if (typeof message === "string") {
            return message;
          }
        }
        return null;
      })
      .filter((item): item is string => Boolean(item))
      .join("; ");

    if (joined) {
      return joined;
    }
  }

  if (detail && typeof detail === "object") {
    if ("message" in detail && typeof detail.message === "string") {
      return detail.message;
    }
    if ("detail" in detail) {
      return getErrorMessage(detail.detail, fallback);
    }
  }

  return fallback;
}
