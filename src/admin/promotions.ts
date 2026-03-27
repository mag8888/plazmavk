import express from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { uploadImage } from '../services/cloudinary-service.js';
import { renderAdminHeader } from './header.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Main Promotions page
router.get('/', async (req, res) => {
  const [promotions, products] = await Promise.all([
    prisma.promotion.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { product: true }
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, title: true, price: true, imageUrl: true }
    })
  ]);

  res.send(`
    ${renderAdminHeader('Акции и спецпредложения')}
    
    <style>
      /* Modal styles */
      .modal {
        display: none; 
        position: fixed; 
        z-index: 1000; 
        left: 0;
        top: 0;
        width: 100%; 
        height: 100%; 
        overflow: auto; 
        background-color: rgba(0,0,0,0.5); 
        backdrop-filter: blur(5px);
        align-items: center;
        justify-content: center;
      }
      
      .modal.show {
        display: flex;
      }

      .modal-content {
        background-color: #fefefe;
        margin: auto;
        padding: 0;
        border: 1px solid #888;
        width: 100%;
        max-width: 600px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        animation: modalFadeIn 0.3s;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
      }

      .modal-header {
        padding: 16px 24px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .modal-header h2 { margin: 0; font-size: 1.25rem; }

      .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
      }

      .modal-body {
        padding: 24px;
        overflow-y: auto;
      }

      .form-group { margin-bottom: 16px; }
      .form-group label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 0.9rem; }
      .form-group input[type="text"],
      .form-group input[type="number"],
      .form-group textarea,
      .form-group select {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
      }

      .form-row { display: flex; gap: 16px; }
      .form-group.half { flex: 1; }

      .modal-footer {
        padding: 16px 24px;
        border-top: 1px solid #eee;
        text-align: right;
        background: #f9fafb;
        border-radius: 0 0 12px 12px;
      }

      @keyframes modalFadeIn {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Checkbox toggle */
      .toggle-switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
      }
      .toggle-switch input { opacity: 0; width: 0; height: 0; }
      .slider {
        position: absolute;
        cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: #ccc;
        transition: .4s;
        border-radius: 24px;
      }
      .slider:before {
        position: absolute;
        content: "";
        height: 18px; width: 18px;
        left: 3px; bottom: 3px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
      }
      input:checked + .slider { background-color: #2196F3; }
      input:checked + .slider:before { transform: translateX(20px); }

      /* Product selection styles */
      .selected-product-card {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 10px;
        display: flex;
        align-items: center;
        gap: 12px;
        background: #f8f9fa;
        margin-top: 8px;
      }
      .selected-product-img {
        width: 40px;
        height: 40px;
        object-fit: cover;
        border-radius: 4px;
        background: #eee;
      }
      .remove-product-btn {
        color: #ff4444;
        cursor: pointer;
        font-size: 12px;
        margin-left: auto;
        padding: 4px 8px;
      }
      .products-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 12px;
        max-height: 400px;
        overflow-y: auto;
        padding: 4px;
      }
      .product-item {
        border: 1px solid #eee;
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .product-item:hover {
        border-color: #2196F3;
        background: #f0f7ff;
      }
      .product-item.selected {
        border-color: #2196F3;
        background: #e3f2fd;
        box-shadow: 0 0 0 1px #2196F3;
      }
      .product-search {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 6px;
        margin-bottom: 12px;
      }
    </style>

    <div class="table-controls">
      <button class="btn btn-primary" onclick="openPromotionModal()">
        + Добавить акцию
      </button>
    </div>

    <div class="users-table-container">
      <table class="users-table">
        <thead>
          <tr>
            <th>Сорт.</th>
            <th>Изображение</th>
            <th>Название / Описание</th>
            <th>Кнопка / Товар</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          ${promotions.map(p => `
            <tr>
              <td>${p.sortOrder}</td>
              <td>
                ${p.imageUrl ? `<img src="${p.imageUrl}" style="width: 80px; height: 45px; object-fit: cover; border-radius: 4px;">` : '<span style="color:#ccc;">Нет фото</span>'}
              </td>
              <td>
                <div style="font-weight:600;">${p.title}</div>
                <div style="font-size:12px; color:#666; max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.description || ''}</div>
              </td>
              <td>
                ${p.product ? `
                  <div style="display:flex; align-items:center; gap:6px; font-size:12px;">
                    <span class="badge badge-success">Товар</span>
                    <span>${p.product.title}</span>
                  </div>
                ` : `
                  ${p.buttonText ? `<span class="badge badge-info">${p.buttonText}</span>` : '<span style="color:#ccc;">—</span>'}
                  ${p.buttonLink ? `<div style="font-size:10px; color:#999;">${p.buttonLink}</div>` : ''}
                `}
              </td>
              <td>
                <span class="status-badge ${p.isActive ? 'status-active' : 'status-inactive'}">
                  ${p.isActive ? 'Активна' : 'Скрыта'}
                </span>
              </td>
              <td class="actions-cell">
                <button class="action-btn" onclick='editPromotion(${JSON.stringify(p).replace(/'/g, "&#39;")})'>
                  ✏️
                </button>
                <button class="action-btn btn-danger" onclick="deletePromotion('${p.id}')">
                  🗑️
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- MAIN PROMOTION MODAL -->
    <div id="promotionModal" class="modal">
      <div class="modal-content" style="max-width: 550px;">
        <div class="modal-header">
          <h2 id="modalTitle">Добавить акцию</h2>
          <button class="close-btn" onclick="closePromotionModal()">×</button>
        </div>
        <form id="promotionForm" enctype="multipart/form-data">
          <input type="hidden" name="id" id="promoId">
          <div class="modal-body">
            <div class="form-group">
              <label>Название акции *</label>
              <input type="text" name="title" id="promoTitle" required placeholder="Например: Скидка 20%">
            </div>
            
            <div class="form-group">
              <label>Описание</label>
              <div id="promoDescriptionEditor" style="height: 150px;"></div>
              <!-- Hidden textarea to store the HTML for form submission -->
              <textarea name="description" id="promoDescription" style="display:none;"></textarea>
            </div>

            <div class="form-group">
              <label>Изображение</label>
              <div id="imagePreview" style="margin-bottom:10px; display:none;">
                <img src="" style="max-width:100%; max-height:150px; border-radius:8px;">
              </div>
              <input type="file" name="image" id="promoImage" accept="image/*">
              <input type="hidden" name="existingImageUrl" id="promoExistingImage">
            </div>

            <!-- PRODUCT LINKING SECTION -->
            <div class="form-group" style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <label style="margin:0;">Привязать товар</label>
                <button type="button" class="btn btn-sm" onclick="openProductSelector()" style="font-size:12px;">Выбрать</button>
              </div>
              
              <input type="hidden" name="productId" id="promoProductId">
              <div id="selectedProductContainer" style="display:none;">
                <div class="selected-product-card">
                  <img id="selectedProductImg" class="selected-product-img" src="">
                  <div>
                     <div id="selectedProductTitle" style="font-weight:600; font-size:13px;"></div>
                     <div id="selectedProductPrice" style="font-size:11px; color:#666;"></div>
                  </div>
                  <span class="remove-product-btn" onclick="clearSelectedProduct()">✕</span>
                </div>
              </div>
              <div id="noProductSelected" style="font-size:12px; color:#999; font-style:italic; padding:4px;">
                Товар не выбран (будет просто баннер)
              </div>
            </div>

            <div class="form-row">
              <div class="form-group half">
                <label>Порядок сортировки</label>
                <input type="number" name="sortOrder" id="promoSortOrder" value="0">
              </div>
              <div class="form-group half" style="display:flex; align-items:center; margin-top:24px;">
                <label class="toggle-switch">
                  <input type="checkbox" name="isActive" id="promoIsActive" checked>
                  <span class="slider"></span>
                </label>
                <span style="margin-left:10px;">Активна</span>
              </div>
            </div>
            
            <div id="legacyButtonFields">
              <div style="margin:10px 0 5px 0; font-size:0.8rem; color:#666; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #eee; padding-bottom:4px;">
                Или своя кнопка (ссылка)
              </div>
              <div class="form-row">
                <div class="form-group half">
                  <label>Текст кнопки</label>
                  <input type="text" name="buttonText" id="promoButtonText" placeholder="Подробнее">
                </div>
                <div class="form-group half">
                  <label>Ссылка (если есть)</label>
                  <input type="text" name="buttonLink" id="promoButtonLink" placeholder="https://...">
                  <small style="display:block; margin-top:6px; color:#888;">(Или введите <b>#catalog</b> для кнопки "В каталог")</small>
                </div>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button type="submit" class="btn btn-primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>

    <!-- PRODUCT SELECTOR MODAL -->
    <div id="productSelectorModal" class="modal" style="z-index: 1100;">
      <div class="modal-content" style="max-width: 500px; height: 80vh;">
        <div class="modal-header">
          <h3>Выбрать товар</h3>
          <button class="close-btn" onclick="document.getElementById('productSelectorModal').classList.remove('show')">×</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; padding:16px;">
          <input type="text" id="productSearchInput" class="product-search" placeholder="Поиск товара..." onkeyup="filterProducts()">
          <div class="products-grid" id="productsList">
            <!-- Products will be populated here -->
          </div>
        </div>
      </div>
    </div>

    <!-- CLIENT SIDE PRODUCTS DATA -->
    <script>
      const PRODUCTS = ${JSON.stringify(products)};

      let promoQuill;
      document.addEventListener("DOMContentLoaded", function() {
        promoQuill = new Quill('#promoDescriptionEditor', {
          theme: 'snow',
          placeholder: 'Краткое описание условий...',
          modules: {
            toolbar: [
              ['bold', 'italic', 'underline', 'strike'],
              [{ 'color': [] }, { 'background': [] }],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              ['clean']
            ]
          }
        });
      });

      function openPromotionModal() {
        document.getElementById('promotionForm').reset();
        document.getElementById('promoId').value = '';
        document.getElementById('modalTitle').textContent = 'Добавить акцию';
        document.getElementById('imagePreview').style.display = 'none';
        if (promoQuill) {
          promoQuill.root.innerHTML = '';
        }
        document.getElementById('promoDescription').value = '';
        document.getElementById('promotionModal').classList.add('show');
        clearSelectedProduct();
      }

      function closePromotionModal() {
        document.getElementById('promotionModal').classList.remove('show');
      }

      function editPromotion(promo) {
        openPromotionModal();
        document.getElementById('modalTitle').textContent = 'Редактировать акцию';
        document.getElementById('promoId').value = promo.id;
        document.getElementById('promoTitle').value = promo.title;
        
        const descHtml = promo.description || '';
        document.getElementById('promoDescription').value = descHtml;
        if (promoQuill) {
          promoQuill.root.innerHTML = descHtml;
        }
        
        document.getElementById('promoSortOrder').value = promo.sortOrder;
        document.getElementById('promoIsActive').checked = promo.isActive;
        document.getElementById('promoButtonText').value = promo.buttonText || '';
        document.getElementById('promoButtonLink').value = promo.buttonLink || '';
        document.getElementById('promoExistingImage').value = promo.imageUrl || '';
        
        if (promo.imageUrl) {
          const imgPreview = document.getElementById('imagePreview');
          imgPreview.querySelector('img').src = promo.imageUrl;
          imgPreview.style.display = 'block';
        }

        if (promo.productId) {
          selectProduct(promo.productId);
        }
      }

      function deletePromotion(id) {
        if(!confirm('Вы уверены, что хотите удалить эту акцию?')) return;
        
        fetch('/admin/promotions/delete/' + id, { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            if(data.success) location.reload();
            else alert('Error deleting');
          });
      }

      // PRODUCT SELECTION LOGIC
      function openProductSelector() {
        renderProductList();
        document.getElementById('productSelectorModal').classList.add('show');
      }

      function renderProductList(filter = '') {
        const container = document.getElementById('productsList');
        container.innerHTML = '';
        const search = filter.toLowerCase();
        
        PRODUCTS.forEach(p => {
          if (p.title.toLowerCase().includes(search)) {
            const div = document.createElement('div');
            div.className = 'product-item';
            div.onclick = () => {
              selectProduct(p.id);
              document.getElementById('productSelectorModal').classList.remove('show');
            };
            
            const img = p.imageUrl || 'https://via.placeholder.com/40';
            
            div.innerHTML = \`
              <img src="\${img}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; background:#eee;">
              <div style="flex:1;">
                <div style="font-size:13px; font-weight:500;">\${p.title}</div>
                <div style="font-size:11px; color:#666;">\${p.price} PZ</div>
              </div>
            \`;
            container.appendChild(div);
          }
        });
      }

      function filterProducts() {
        const val = document.getElementById('productSearchInput').value;
        renderProductList(val);
      }

      function selectProduct(id) {
        const p = PRODUCTS.find(x => x.id === id);
        if (!p) return;

        document.getElementById('promoProductId').value = p.id;
        document.getElementById('selectedProductImg').src = p.imageUrl || '';
        document.getElementById('selectedProductTitle').textContent = p.title;
        document.getElementById('selectedProductPrice').textContent = p.price + ' PZ';
        
        document.getElementById('selectedProductContainer').style.display = 'block';
        document.getElementById('noProductSelected').style.display = 'none';
        
        // Hide legacy button fields when product is selected to avoid confusion?
        // document.getElementById('legacyButtonFields').style.opacity = '0.5';
      }

      function clearSelectedProduct() {
        document.getElementById('promoProductId').value = '';
        document.getElementById('selectedProductContainer').style.display = 'none';
        document.getElementById('noProductSelected').style.display = 'block';
      }

      document.getElementById('promotionForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Sync Quill HTML content to the hidden textarea before submitting
        if (promoQuill) {
          document.getElementById('promoDescription').value = promoQuill.root.innerHTML;
        }

        const formData = new FormData(this);
        
        // Handle checkbox manually
        formData.set('isActive', document.getElementById('promoIsActive').checked);

        try {
          const res = await fetch('/admin/promotions/save', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          
          if(data.success) {
            location.reload();
          } else {
            alert('Error: ' + data.error);
          }
        } catch(err) {
          console.error(err);
          alert('Failed to save promotion');
        }
      });
    </script>
  `);
});

// Save promotion
router.post('/save', upload.single('image'), async (req, res) => {
  try {
    const {
      id, title, description, buttonText, buttonLink,
      sortOrder, isActive, existingImageUrl, productId
    } = req.body;

    let imageUrl = existingImageUrl;

    if (req.file) {
      const uploadResult = await uploadImage(req.file.buffer, { folder: 'promotions' });
      imageUrl = uploadResult.secureUrl;
    }

    const data = {
      title,
      description,
      buttonText,
      // If product is selected, we might clear buttonLink or keep it as override.
      // For now, let's keep buttonLink as an optional override or just ignore it in frontend if productId exists.
      buttonLink,
      imageUrl,
      sortOrder: parseInt(sortOrder) || 0,
      isActive: isActive === 'true',
      productId: productId || null // Save linked product
    };

    if (id) {
      await prisma.promotion.update({
        where: { id },
        data
      });
    } else {
      await prisma.promotion.create({
        data
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving promotion:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete promotion
router.post('/delete/:id', async (req, res) => {
  try {
    await prisma.promotion.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export const promotionsRouter = router;
