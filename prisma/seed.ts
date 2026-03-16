import "dotenv/config";
import bcrypt from "bcryptjs";

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  console.log("Seeding database...");

  // Create admin user
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

  // Create driver user
  const driverPassword = await bcrypt.hash("driver123", 10);
  const driver = await prisma.user.upsert({
    where: { email: "driver@pharmacy.com" },
    update: {},
    create: {
      email: "driver@pharmacy.com",
      name: "John Driver",
      passwordHash: driverPassword,
      role: "DRIVER",
      phone: "604-555-0200",
    },
  });
  console.log("Created driver:", driver.email);

  // Create delivery zones
  const zones = [
    { name: "Surrey", price: 4.25 },
    { name: "Vancouver", price: 5.50 },
    { name: "Burnaby", price: 4.75 },
    { name: "Richmond", price: 5.00 },
    { name: "Langley", price: 6.00 },
    { name: "Coquitlam", price: 5.25 },
  ];

  for (const zone of zones) {
    await prisma.deliveryZone.upsert({
      where: { name: zone.name },
      update: { price: zone.price },
      create: zone,
    });
  }
  console.log("Created delivery zones:", zones.map((z) => z.name).join(", "));

  // Create sample orders for today
  const surreyZone = await prisma.deliveryZone.findUnique({
    where: { name: "Surrey" },
  });
  const vancouverZone = await prisma.deliveryZone.findUnique({
    where: { name: "Vancouver" },
  });

  if (surreyZone && vancouverZone) {
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
          deliveryZoneId: surreyZone.id,
          deliveryZoneName: "Surrey",
          priceAtCreation: surreyZone.price,
          instructions: "Leave at front door",
          status: "ASSIGNED",
          scheduledDate: today,
          assignedDriverId: driver.id,
          createdById: admin.id,
        },
        {
          patientName: "Bob Johnson",
          patientPhone: "604-555-1002",
          deliveryAddress: "456 Main St",
          deliveryCity: "Vancouver",
          deliveryPostalCode: "V5V 3A1",
          deliveryZoneId: vancouverZone.id,
          deliveryZoneName: "Vancouver",
          priceAtCreation: vancouverZone.price,
          instructions: "Ring doorbell twice",
          status: "PENDING",
          scheduledDate: today,
          createdById: admin.id,
        },
        {
          patientName: "Alice Williams",
          patientPhone: "604-555-1003",
          deliveryAddress: "789 Oak Ave",
          deliveryCity: "Surrey",
          deliveryPostalCode: "V3S 4R2",
          deliveryZoneId: surreyZone.id,
          deliveryZoneName: "Surrey",
          priceAtCreation: surreyZone.price,
          status: "ASSIGNED",
          scheduledDate: today,
          assignedDriverId: driver.id,
          createdById: admin.id,
        },
      ],
    });
    console.log("Created sample orders");

    // Create a recurring order template
    await prisma.recurringOrder.create({
      data: {
        patientName: "Regular Patient Mary",
        patientPhone: "604-555-2001",
        deliveryAddress: "100 Recurring Rd",
        deliveryCity: "Surrey",
        deliveryPostalCode: "V3T 1A1",
        deliveryZoneId: surreyZone.id,
        instructions: "Weekly prescription",
        dayOfWeek: 1, // Monday
        createdById: admin.id,
      },
    });
    console.log("Created recurring order template");
  }

  console.log("\nSeed complete!");
  console.log("\nLogin credentials:");
  console.log("  Admin: admin@pharmacy.com / admin123");
  console.log("  Driver: driver@pharmacy.com / driver123");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
