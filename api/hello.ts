// Đây là code chạy trên Server (Backend)
export const config = { runtime: 'edge' }; // Tối ưu cho Vercel

export default async (req: Request) => {
  return new Response(JSON.stringify({ message: "Chào bạn từ Backend!" }), {
    headers: { "Content-Type": "application/json" },
  });
};