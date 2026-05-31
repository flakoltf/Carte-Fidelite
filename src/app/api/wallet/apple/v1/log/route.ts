import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[ApplePass log]", JSON.stringify(body).slice(0, 500));
  } catch {
    // corps absent/illisible — sans importance pour un endpoint de log
  }
  return new NextResponse(null, { status: 200 });
}
