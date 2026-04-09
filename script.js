async function loadRecordings() {
    const grid = document.getElementById('grid');
    // Clear the placeholder cards immediately
    grid.innerHTML = '<p class="loading">Loading avian symphonies...</p>';
    const MY_RECORDINGS = ['729053'];

    try {
      // 1. Correct Query Construction
      const query = MY_RECORDINGS.map(id => `nr:${id}`).join(' OR ');
      
      // 2. Use the correct API URL + a CORS Proxy
      const proxy = 'https://corsproxy.io/?';
      const apiUrl = `https://xeno-canto.org/api/2/recordings?query=nr:${MY_RECORDINGS[0]}`;

      // This combines them so the request can get through the "wall"
      const response = await fetch(proxy + encodeURIComponent(apiUrl));
      
      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
  
      if (!data.recordings || data.recordings.length === 0) {
        grid.innerHTML = '<p class="error">No recordings found for those IDs.</p>';
        return;
      }
  
      grid.innerHTML = '';
  
      data.recordings.forEach(rec => {
        const audioUrl = rec.file.startsWith('http') ? rec.file : `https:${rec.file}`;

        card.innerHTML = `
        <div class="bird-name">${rec.en}</div>
        <audio controls>
            <source src="${audioUrl}" type="audio/mpeg">
            Your browser does not support the audio element.
        </audio>
        `;
        grid.appendChild(card);
      });
  
    } catch (error) {
      grid.innerHTML = `<p class="error">Connection Error: ${error.message}</p>`;
      console.error("API Error:", error);
    }
  }