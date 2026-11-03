export async function uploadFile(
    file: File,
    type: 'image' | 'raw',
    access: 'public' | 'premium' = 'public'
  ): Promise<{ url: string | null; publicId: string }> {
    const token = localStorage.getItem('readgrid_token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('access', access);
  
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Не вдалося завантажити файл');
    return { url: data.url, publicId: data.publicId };
  }