export function friendlyAiError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();

  if (message.includes("missing anthropic_api_key") || message.includes("api key")) {
    return "Problem z AI: brakuje poprawnego klucza Anthropic w Supabase Secrets.";
  }

  if (message.includes("anthropic error 401") || message.includes("unauthorized")) {
    return "Problem z AI: klucz Anthropic jest niepoprawny albo wygasł.";
  }

  if (message.includes("anthropic error 429") || message.includes("rate")) {
    return "Problem z AI: limit zapytań został chwilowo przekroczony. Spróbuj ponownie za moment.";
  }

  if (message.includes("anthropic error 400") || message.includes("model")) {
    return "Problem z AI: model lub format zapytania wymaga poprawki w konfiguracji.";
  }

  if (message.includes("zod") || message.includes("invalid") || message.includes("parse")) {
    return "Problem z AI: odpowiedź została poprawiona po stronie aplikacji, spróbuj ponownie. Jeśli błąd wróci, skróć dokument albo doprecyzuj zadania.";
  }

  if (message.includes("valid json") || message.includes("no text content")) {
    return "Problem z AI: odpowiedź jest zbyt długa lub portfel zbyt duży — spróbuj ponownie, gdy będzie mniej aktywnych projektów.";
  }

  if (message.includes("failed to fetch") || message.includes("timeout") || message.includes("network")) {
    return "Problem z AI: nie udało się połączyć z usługą. Sprawdź połączenie albo spróbuj ponownie.";
  }

  return "Problem z AI: usługa nie zwróciła poprawnej odpowiedzi. Spróbuj ponownie lub doprecyzuj opis.";
}
