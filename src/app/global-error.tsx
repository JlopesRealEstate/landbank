"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ background: "#f4f2ee", fontFamily: "Inter, Arial, sans-serif", margin: 0 }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div
            style={{
              maxWidth: 460,
              background: "#fff",
              border: "1px solid #ddd9d1",
              borderRadius: 16,
              padding: 24,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#6b7a80", margin: 0 }}>
              Land Bank Corp
            </p>
            <h1 style={{ fontSize: 18, margin: "6px 0 8px", color: "#0d2027" }}>Não foi possível carregar o CRM</h1>
            <p style={{ fontSize: 13, color: "#6b7a80", margin: 0 }}>
              Ocorreu um erro ao iniciar a aplicação. Recarregue a página para tentar novamente.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 16,
                background: "#0b2a35",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Recarregar
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
