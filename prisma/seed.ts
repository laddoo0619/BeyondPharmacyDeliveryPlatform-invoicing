import "dotenv/config";
import bcrypt from "bcryptjs";

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  console.log("Seeding database...");

  // Create stores
  const surreyStore = await prisma.store.upsert({
    where: { slug: "surrey" },
    update: {},
    create: {
      name: "Beyond Pharmacy Surrey",
      slug: "surrey",
    },
  });
  console.log("Created store:", surreyStore.name);

  const abbotsfordStore = await prisma.store.upsert({
    where: { slug: "abbotsford" },
    update: {},
    create: {
      name: "Beyond Pharmacy Abbotsford",
      slug: "abbotsford",
    },
  });
  console.log("Created store:", abbotsfordStore.name);

  // Create admin user (no storeId — admins can access all stores)
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@pharmacy.com" },
    update: {},
    create: {
      email: "admin@pharmacy.com",
      name: "Pharmacy Admin",
      passwordHash: adminPassword,
      role: "PHARMACY_ADMIN",
      phone: "604-555-0100",
    },
  });
  console.log("Created admin:", admin.email);

  // Create driver for Surrey
  const driverPassword = await bcrypt.hash("driver123", 10);
  const surreyDriver = await prisma.user.upsert({
    where: { email: "driver-surrey@pharmacy.com" },
    update: {},
    create: {
      email: "driver-surrey@pharmacy.com",
      name: "John Driver (Surrey)",
      passwordHash: driverPassword,
      role: "DRIVER",
      phone: "604-555-0200",
      storeId: surreyStore.id,
    },
  });
  console.log("Created Surrey driver:", surreyDriver.email);

  // Create driver for Abbotsford
  const abbotsfordDriver = await prisma.user.upsert({
    where: { email: "driver-abbotsford@pharmacy.com" },
    update: {},
    create: {
      email: "driver-abbotsford@pharmacy.com",
      name: "Jane Driver (Abbotsford)",
      passwordHash: driverPassword,
      role: "DRIVER",
      phone: "604-555-0300",
      storeId: abbotsfordStore.id,
    },
  });
  console.log("Created Abbotsford driver:", abbotsfordDriver.email);

  // Create delivery zones for Surrey store
  const surreyZones = [
    { name: "Surrey", price: 4.25 },
    { name: "Vancouver", price: 5.50 },
    { name: "Burnaby", price: 4.75 },
    { name: "Richmond", price: 5.00 },
    { name: "Langley", price: 6.00 },
    { name: "Coquitlam", price: 5.25 },
  ];

  for (const zone of surreyZones) {
    await prisma.deliveryZone.upsert({
      where: { name_storeId: { name: zone.name, storeId: surreyStore.id } },
      update: { price: zone.price },
      create: { ...zone, storeId: surreyStore.id },
    });
  }
  console.log("Created Surrey delivery zones:", surreyZones.map((z) => z.name).join(", "));

  // Create delivery zones for Abbotsford store
  const abbotsfordZones = [
    { name: "Abbotsford", price: 4.25 },
    { name: "Chilliwack", price: 5.50 },
    { name: "Mission", price: 5.00 },
    { name: "Langley", price: 5.25 },
    { name: "Maple Ridge", price: 6.00 },
  ];

  for (const zone of abbotsfordZones) {
    await prisma.deliveryZone.upsert({
      where: { name_storeId: { name: zone.name, storeId: abbotsfordStore.id } },
      update: { price: zone.price },
      create: { ...zone, storeId: abbotsfordStore.id },
    });
  }
  console.log("Created Abbotsford delivery zones:", abbotsfordZones.map((z) => z.name).join(", "));

  // Create sample orders for Surrey store
  const surreySurreyZone = await prisma.deliveryZone.findUnique({
    where: { name_storeId: { name: "Surrey", storeId: surreyStore.id } },
  });
  const surreyVancouverZone = await prisma.deliveryZone.findUnique({
    where: { name_storeId: { name: "Vancouver", storeId: surreyStore.id } },
  });

  if (surreySurreyZone && surreyVancouverZone) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.order.createMany({
      data: [
        {
          patientName: "Jane Smith",
          patientPhone: "604-555-1001",
          deliveryAddress: "123 King George Blvd",
          deliveryCity: "Surrey",
          deliveryPostalCode: "V3T 2T8",
          deliveryZoneId: surreySurreyZone.id,
          deliveryZoneName: "Surrey",
          priceAtCreation: surreySurreyZone.price,
          instructions: "Leave at front door",
          status: "ASSIGNED",
          scheduledDate: today,
          assignedDriverId: surreyDriver.id,
          createdById: admin.id,
          storeId: surreyStore.id,
        },
        {
          patientName: "Bob Johnson",
          patientPhone: "604-555-1002",
          deliveryAddress: "456 Main St",
          deliveryCity: "Vancouver",
          deliveryPostalCode: "V5V 3A1",
          deliveryZoneId: surreyVancouverZone.id,
          deliveryZoneName: "Vancouver",
          priceAtCreation: surreyVancouverZone.price,
          instructions: "Ring doorbell twice",
          status: "PENDING",
          scheduledDate: today,
          createdById: admin.id,
          storeId: surreyStore.id,
        },
      ],
    });
    console.log("Created Surrey sample orders");

    await prisma.recurringOrder.create({
      data: {
        patientName: "Regular Patient Mary",
        patientPhone: "604-555-2001",
        deliveryAddress: "100 Recurring Rd",
        deliveryCity: "Surrey",
        deliveryPostalCode: "V3T 1A1",
        deliveryZoneId: surreySurreyZone.id,
        instructions: "Weekly prescription",
        activeDays: JSON.stringify([1]),
        createdById: admin.id,
        storeId: surreyStore.id,
      },
    });
    console.log("Created Surrey recurring order template");
  }

  // Create sample orders for Abbotsford store
  const abbotsfordAbbotsfordZone = await prisma.deliveryZone.findUnique({
    where: { name_storeId: { name: "Abbotsford", storeId: abbotsfordStore.id } },
  });

  if (abbotsfordAbbotsfordZone) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.order.createMany({
      data: [
        {
          patientName: "Tom Wilson",
          patientPhone: "604-555-3001",
          deliveryAddress: "789 South Fraser Way",
          deliveryCity: "Abbotsford",
          deliveryPostalCode: "V2S 2A1",
          deliveryZoneId: abbotsfordAbbotsfordZone.id,
          deliveryZoneName: "Abbotsford",
          priceAtCreation: abbotsfordAbbotsfordZone.price,
          instructions: "Side entrance",
          status: "ASSIGNED",
          scheduledDate: today,
          assignedDriverId: abbotsfordDriver.id,
          createdById: admin.id,
          storeId: abbotsfordStore.id,
        },
      ],
    });
    console.log("Created Abbotsford sample orders");
  }

  console.log("\nSeed complete!");
  console.log("\nLogin credentials:");
  console.log("  Admin: admin@pharmacy.com / admin123");
  console.log("  Surrey Driver: driver-surrey@pharmacy.com / driver123");
  console.log("  Abbotsford Driver: driver-abbotsford@pharmacy.com / driver123");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
