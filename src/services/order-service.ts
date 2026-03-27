import { prisma } from '../lib/prisma.js';

interface OrderItemPayload {
  productId: string;
  title: string;
  price: number;
  quantity: number;
}

export async function createOrderRequest(params: {
  userId?: string;
  contact?: string;
  message: string;
  items: OrderItemPayload[];
}) {
  const itemsJson = params.items.map((item) => ({
    ...item,
    price: Number(item.price),
  }));

  console.log('🛒 Creating order request:', {
    userId: params.userId,
    contact: params.contact,
    message: params.message,
    itemsCount: params.items.length,
    items: params.items
  });

  const order = await prisma.orderRequest.create({
    data: {
      userId: params.userId,
      contact: params.contact,
      message: params.message,
      itemsJson,
    },
  });

  console.log('✅ Order request created successfully:', {
    orderId: order.id,
    userId: order.userId,
    status: order.status,
    createdAt: order.createdAt
  });

  return order;
}
