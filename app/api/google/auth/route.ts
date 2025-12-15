import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google-calendar";

// GET /api/google/auth - Retorna URL de autorização do Google
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const authUrl = getAuthUrl();
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Erro ao gerar URL de auth:", error);
    return NextResponse.json(
      { error: "Erro ao gerar URL de autorização" },
      { status: 500 }
    );
  }
}
