// POST /admin/products/:id/update - Update product with optional image upload
router.post('/products/:id/update', requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const productId = req.params.id;
        const {
            title,
            price,
            summary,
            description,
            categoryId,
            stock,
            isActive,
            availableInRussia,
            availableInBali
        } = req.body;

        console.log('📝 Updating product:', productId);
        console.log('📤 Has image?', !!req.file);

        // Prepare update data
        const updateData: any = {
            title: String(title || ''),
            price: parseFloat(String(price || '0')),
            summary: String(summary || ''),
            description: String(description || ''),
            categoryId: String(categoryId || ''),
            stock: parseInt(String(stock || '999')),
            isActive: isActive === 'true',
            availableInRussia: availableInRussia === 'true',
            availableInBali: availableInBali === 'true'
        };

        // Upload image to Cloudinary if provided
        if (req.file) {
            console.log('📸 Uploading image to Cloudinary...');
            const { secure_url } = await uploadImage(req.file.buffer, { folder: 'plazma-bot/products' });
            updateData.imageUrl = secure_url;
            console.log('✅ Image uploaded:', secure_url);
        }

        // Update product in database
        const updated = await prisma.product.update({
            where: { id: productId },
            data: updateData
        });

        console.log('✅ Product updated successfully');
        res.json({ success: true, product: updated });
    } catch (error) {
        console.error('❌ Error updating product:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
