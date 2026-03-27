/**
 * CSS styles for products admin page
 * Centralized styles to improve maintainability
 */

export const PRODUCTS_STYLES = `
body { 
  font-family: Arial, sans-serif; 
  max-width: 1200px; 
  margin: 20px auto; 
  padding: 20px; 
  background: #f5f5f5; 
}

a.btn, button.btn { 
  display: inline-block; 
  padding: 10px 20px; 
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  color: white; 
  text-decoration: none; 
  border: none;
  border-radius: 8px; 
  margin: 5px 0 20px; 
  transition: all 0.2s ease;
  cursor: pointer;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0,123,255,0.3);
}

a.btn:hover, button.btn:hover { 
  background: linear-gradient(135deg, #0056b3 0%, #004085 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,123,255,0.4);
}

h2 { 
  margin-top: 0; 
  color: #1f2937; 
  font-weight: 600; 
}

.filters { 
  display: flex; 
  flex-wrap: wrap; 
  gap: 10px; 
  margin-bottom: 20px; 
}

.filter-btn { 
  padding: 8px 16px; 
  border: none; 
  border-radius: 999px; 
  background: #e0e7ff; 
  color: #1d4ed8; 
  cursor: pointer; 
  transition: all 0.2s ease; 
}

.filter-btn:hover { 
  background: #c7d2fe; 
}

.filter-btn.active { 
  background: #1d4ed8; 
  color: #fff; 
  box-shadow: 0 4px 10px rgba(29, 78, 216, 0.2); 
}

.product-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
  gap: 20px; 
}

.product-card { 
  background: #fff; 
  border-radius: 12px; 
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08); 
  padding: 18px; 
  display: flex; 
  flex-direction: column; 
  gap: 12px; 
  transition: transform 0.2s ease, box-shadow 0.2s ease; 
}

.product-card:hover { 
  transform: translateY(-4px); 
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12); 
}

.product-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: flex-start; 
}

.product-title { 
  font-size: 18px; 
  font-weight: 600; 
  color: #111827; 
  margin: 0; 
}

.badge { 
  padding: 4px 10px; 
  border-radius: 999px; 
  font-size: 12px; 
  font-weight: 600; 
  display: inline-block; 
}

.badge-status-active { 
  background: #dcfce7; 
  color: #166534; 
}

.badge-status-inactive { 
  background: #fee2e2; 
  color: #991b1b; 
}

.status-btn { 
  transition: all 0.2s ease; 
}

.status-btn:hover { 
  transform: scale(1.1); 
}

.status-btn.active { 
  color: #28a745; 
}

.status-btn.inactive { 
  color: #dc3545; 
}

.badge-category { 
  background: #e5e7eb; 
  color: #374151; 
}

.product-summary { 
  color: #4b5563; 
  font-size: 14px; 
  line-height: 1.5; 
  margin: 0; 
}

.product-price { 
  font-size: 16px; 
  font-weight: 600; 
  color: #1f2937; 
}

.product-meta { 
  font-size: 12px; 
  color: #6b7280; 
  display: flex; 
  justify-content: space-between; 
}

.product-actions { 
  display: flex; 
  flex-wrap: wrap; 
  gap: 8px; 
}

.product-actions form { 
  margin: 0; 
}

.product-actions button { 
  padding: 8px 14px; 
  border: none; 
  border-radius: 8px; 
  cursor: pointer; 
  font-size: 12px; 
  font-weight: 600; 
  white-space: nowrap;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.product-actions button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.product-actions .toggle-btn { 
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #fff;
}

.product-actions .toggle-btn:hover { 
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.product-actions .delete-btn { 
  background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  color: #fff;
}

.product-actions .delete-btn:hover { 
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.product-actions .image-btn { 
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
}

.product-actions .image-btn:hover { 
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

.product-actions .edit-btn { 
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: #fff;
}

.product-actions .edit-btn:hover { 
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
}

.product-actions .instruction-btn {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: #fff;
}

.product-actions .instruction-btn:hover {
  background: linear-gradient(135deg, #20c997 0%, #17a2b8 100%);
}

.empty-state { 
  text-align: center; 
  padding: 60px 20px; 
  color: #6b7280; 
  background: #fff; 
  border-radius: 12px; 
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08); 
}

img.product-image { 
  width: 100%; 
  height: 200px; 
  object-fit: cover; 
  border-radius: 10px; 
}

.product-image-placeholder { 
  width: 100%; 
  height: 200px; 
  border: 2px dashed #d1d5db; 
  border-radius: 10px; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  background: #f9fafb; 
  color: #6b7280; 
}

.placeholder-icon { 
  font-size: 32px; 
  margin-bottom: 8px; 
}

.placeholder-text { 
  font-size: 14px; 
  font-weight: 500; 
}

.alert { 
  padding: 12px 16px; 
  margin: 16px 0; 
  border-radius: 8px; 
  font-weight: 500; 
}

.alert-success { 
  background: #dcfce7; 
  color: #166534; 
  border: 1px solid #bbf7d0; 
}

.alert-error { 
  background: #fee2e2; 
  color: #991b1b; 
  border: 1px solid #fecaca; 
}

/* Modal styles */
.modal-overlay { 
  position: fixed; 
  top: 0; 
  left: 0; 
  width: 100%; 
  height: 100%; 
  background: rgba(0,0,0,0.6); 
  backdrop-filter: blur(4px); 
  z-index: 1000; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  animation: modalFadeIn 0.3s ease-out;
}

@keyframes modalFadeIn { 
  from { opacity: 0; } 
  to { opacity: 1; } 
}

@keyframes modalSlideIn { 
  from { transform: translateY(-20px) scale(0.95); opacity: 0; } 
  to { transform: translateY(0) scale(1); opacity: 1; } 
}

.modal-content { 
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); 
  border-radius: 16px; 
  padding: 0; 
  max-width: 700px; 
  width: 95%; 
  max-height: 90vh; 
  overflow-y: auto; 
  box-shadow: 0 25px 50px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.1); 
  animation: modalSlideIn 0.3s ease-out;
  border: 1px solid rgba(255,255,255,0.2);
}

.modal-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 24px 28px; 
  border-bottom: 1px solid rgba(226, 232, 240, 0.8); 
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px 16px 0 0;
  color: white;
}

.modal-header h2 { 
  margin: 0; 
  font-size: 22px; 
  font-weight: 700; 
  color: white; 
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.close-btn { 
  background: rgba(255,255,255,0.2); 
  border: none; 
  font-size: 20px; 
  cursor: pointer; 
  color: white; 
  padding: 0; 
  width: 32px; 
  height: 32px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  border-radius: 8px; 
  transition: all 0.2s ease;
}

.close-btn:hover { 
  background: rgba(255,255,255,0.3); 
  transform: scale(1.1); 
}

.modal-form { 
  padding: 28px; 
}

.form-section { 
  margin-bottom: 24px; 
}

.form-section-title { 
  font-size: 16px; 
  font-weight: 600; 
  color: #1e293b; 
  margin-bottom: 16px; 
  padding-bottom: 8px; 
  border-bottom: 2px solid #e2e8f0; 
  display: flex; 
  align-items: center; 
  gap: 8px;
}

.form-section-title::before { 
  content: '📋'; 
  font-size: 18px; 
}

.form-grid { 
  display: grid; 
  grid-template-columns: 1fr 1fr; 
  gap: 20px; 
}

.form-grid.single { 
  grid-template-columns: 1fr; 
}

.form-group { 
  margin-bottom: 20px; 
}

.form-group label { 
  display: block; 
  margin-bottom: 8px; 
  font-weight: 600; 
  color: #374151; 
  font-size: 14px; 
  text-transform: uppercase; 
  letter-spacing: 0.5px;
}

.form-group input, .form-group select, .form-group textarea { 
  width: 100%; 
  padding: 12px 16px; 
  border: 2px solid #e2e8f0; 
  border-radius: 10px; 
  font-size: 14px; 
  transition: all 0.2s ease;
  background: #ffffff; 
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.form-group input:focus, .form-group select:focus, .form-group textarea:focus { 
  outline: none; 
  border-color: #667eea; 
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1); 
  transform: translateY(-1px);
}

.form-group textarea { 
  min-height: 80px; 
  resize: vertical; 
}

.form-group textarea.large { 
  min-height: 120px; 
}

.price-row { 
  display: grid; 
  grid-template-columns: 1fr 1fr; 
  gap: 16px; 
}

.price-input { 
  position: relative; 
}

.price-input::after { 
  content: 'PZ'; 
  position: absolute; 
  right: 12px; 
  top: 50%; 
  transform: translateY(-50%); 
  color: #6b7280; 
  font-weight: 600; 
  pointer-events: none;
}

.price-input.rub::after { 
  content: 'RUB'; 
}

.form-actions { 
  display: flex; 
  gap: 16px; 
  justify-content: flex-end; 
  padding: 24px 28px; 
  border-top: 1px solid rgba(226, 232, 240, 0.8); 
  background: #f8fafc; 
  border-radius: 0 0 16px 16px;
}

.form-actions button { 
  padding: 12px 24px; 
  border: none; 
  border-radius: 10px; 
  font-weight: 600; 
  cursor: pointer; 
  transition: all 0.2s ease; 
  font-size: 14px; 
  text-transform: uppercase; 
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.form-actions button[type="button"] { 
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); 
  color: #64748b; 
  border: 1px solid #cbd5e1;
}

.form-actions button[type="button"]:hover { 
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%); 
  transform: translateY(-1px); 
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.form-actions button[type="submit"] { 
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
  color: white; 
  border: 1px solid #5a67d8;
}

.form-actions button[type="submit"]:hover { 
  background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%); 
  transform: translateY(-1px); 
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.regions-grid { 
  display: grid; 
  grid-template-columns: 1fr 1fr; 
  gap: 16px; 
}

.switch-row { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  cursor: pointer; 
  padding: 12px; 
  border: 2px solid #e2e8f0; 
  border-radius: 10px; 
  transition: all 0.2s ease; 
  background: #ffffff;
}

.switch-row:hover { 
  border-color: #667eea; 
  background: #f8fafc; 
}

.switch-row input[type="checkbox"], .status-row input[type="checkbox"] { 
  display: none; 
}

.switch-slider { 
  width: 48px; 
  height: 28px; 
  background: #cbd5e1; 
  border-radius: 14px; 
  position: relative; 
  transition: all 0.3s ease; 
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
}

.switch-slider::before { 
  content: ''; 
  position: absolute; 
  top: 3px; 
  left: 3px; 
  width: 22px; 
  height: 22px; 
  background: white; 
  border-radius: 50%; 
  transition: all 0.3s ease; 
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.switch-row input[type="checkbox"]:checked + .switch-slider,
.status-row input[type="checkbox"]:checked + .switch-slider { 
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
}

.switch-row input[type="checkbox"]:checked + .switch-slider::before,
.status-row input[type="checkbox"]:checked + .switch-slider::before { 
  transform: translateX(20px); 
}

.switch-label { 
  font-weight: 600; 
  color: #374151; 
}

.status-section { 
  background: #f8fafc; 
  padding: 16px; 
  border-radius: 10px; 
  border: 2px solid #e2e8f0; 
}

.status-row { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
}

.status-label { 
  font-weight: 600; 
  color: #374151; 
  font-size: 16px; 
}

.btn-translate {
  padding: 6px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
  white-space: nowrap;
}

.btn-translate:hover {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
}

.btn-translate:active {
  transform: translateY(0);
}

.btn-translate:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Instruction modal styles */
.instruction-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.instruction-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.instruction-content {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  transform: scale(0.8);
  transition: transform 0.3s ease;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
}

.instruction-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.instruction-header h3 {
  color: #333;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  color: #6c757d;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.btn-close:hover {
  background: #f8f9fa;
  color: #333;
}

.instruction-body {
  padding: 20px 24px;
  max-height: 50vh;
  overflow-y: auto;
}

.instruction-text {
  color: #333;
  line-height: 1.6;
  font-size: 14px;
  white-space: pre-wrap;
}

.instruction-footer {
  padding: 16px 24px 20px;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: flex-end;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: #5a6268;
}

/* Responsive */
@media (max-width: 768px) {
  .modal-content { width: 98%; margin: 10px; }
  .form-grid { grid-template-columns: 1fr; }
  .price-row { grid-template-columns: 1fr; }
  .regions-grid { grid-template-columns: 1fr; }
  .form-actions { flex-direction: column; }
}
`;










