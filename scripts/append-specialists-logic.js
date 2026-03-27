
// --- Specialists on Main Page Logic ---

async function loadSpecialistsOnMainPage() {
    const container = document.getElementById('specialists-container');
    const section = document.getElementById('specialists-section');
    if (!container || !section) return;

    try {
        const resp = await fetch(`${API_BASE}/specialists`);
        if (!resp.ok) throw new Error('Failed to fetch specialists');
        const data = await resp.json();
        const specialists = Array.isArray(data?.specialists) ? data.specialists : [];

        if (specialists.length === 0) {
            section.style.display = 'none';
            return;
        }

        let html = '<div class="products-horizontal">';
        specialists.forEach(sp => {
            html += renderSpecialistCardMainPage(sp);
        });
        html += '</div>';

        container.innerHTML = html;
        section.style.display = 'block';
    } catch (e) {
        console.error('Error loading main page specialists:', e);
        section.style.display = 'none';
    }
}

function renderSpecialistCardMainPage(sp) {
    const photo = sp.photoUrl
        ? `<div class="card-image" style="background-image: url('${escapeHtml(sp.photoUrl)}');"></div>`
        : `<div class="card-image" style="background-color: #f3f4f6; display: flex; align-items: center; justify-content: center;"><span style="font-size: 24px;">👤</span></div>`;

    const spName = sp.specialtyRef?.name || sp.specialty || '';

    // Using existing shop-card style for consistency but simpler
    return `
      <div class="shop-card" onclick="openSpecialistDetail('${sp.id}')" style="width: 160px; min-width: 160px;">
        <div class="card-inner">
            ${photo}
            <div class="card-title" style="padding: 12px; font-size: 14px; text-shadow: none; color: var(--text-primary); background: white;">
                <div style="font-weight: 700; margin-bottom: 4px;">${escapeHtml(sp.name || '')}</div>
                <div style="font-size: 12px; color: var(--text-secondary); font-weight: 400;">${escapeHtml(spName)}</div>
            </div>
        </div>
      </div>
    `;
}

// Hook into the main page loader
// We append this call to the end of loadProductsOnMainPage or call it after
const originalLoadProductsOnMainPage = window.loadProductsOnMainPage || loadProductsOnMainPage;
window.loadProductsOnMainPage = async function () {
    await originalLoadProductsOnMainPage();
    loadSpecialistsOnMainPage();
};

// Also load immediately if we are roughly at startup (though app.js is big, we can just call it)
// But safer to rely on the hook above since app.js initialization calls loadProductsOnMainPage
