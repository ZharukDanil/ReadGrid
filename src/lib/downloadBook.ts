// src/lib/downloadBook.ts
export async function downloadBook(bookId: string) {
    const token = localStorage.getItem('readgrid_token');
    try {
      const res = await fetch(`/api/books/${bookId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Не вдалося отримати файл');
        return;
      }
      const link = document.createElement('a');
      link.href = data.fileUrl;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert('Помилка мережі');
    }
  }