const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function identifyContact(email, phoneNumber) {
  if (!email && !phoneNumber) {
    throw new Error("At least one of email or phoneNumber is required");
  }

  return prisma.$transaction(async (tx) => {

    // 1️⃣ Find all contacts matching email OR phone
    const matchedContacts = await tx.contact.findMany({
      where: {
        OR: [
          email ? { email } : undefined,
          phoneNumber ? { phoneNumber } : undefined
        ].filter(Boolean),
        deletedAt: null
      },
      orderBy: { createdAt: "asc" }
    });

    // 2️⃣ If no matches → create new primary
    if (matchedContacts.length === 0) {
      const newContact = await tx.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "primary"
        }
      });

      return buildResponse([newContact]);
    }

    // 3️⃣ Collect all related contacts (chain-safe)
    const contactIds = new Set();

    for (const contact of matchedContacts) {
      contactIds.add(contact.id);
      if (contact.linkedId) contactIds.add(contact.linkedId);
    }

    const allContacts = await tx.contact.findMany({
      where: {
        OR: [
          { id: { in: Array.from(contactIds) } },
          { linkedId: { in: Array.from(contactIds) } }
        ],
        deletedAt: null
      },
      orderBy: { createdAt: "asc" }
    });

    // 4️⃣ Determine oldest primary
    const primaries = allContacts.filter(
      c => c.linkPrecedence === "primary"
    );

    const oldestPrimary = primaries.reduce((oldest, current) => {
      return new Date(current.createdAt) < new Date(oldest.createdAt)
        ? current
        : oldest;
    });

    const primaryId = oldestPrimary.id;

    // 5️⃣ Convert other primaries to secondary
    const otherPrimaries = primaries.filter(p => p.id !== primaryId);

    for (const p of otherPrimaries) {
      await tx.contact.update({
        where: { id: p.id },
        data: {
          linkPrecedence: "secondary",
          linkedId: primaryId
        }
      });
    }

    // 6️⃣ Refresh cluster after merge
    const cluster = await tx.contact.findMany({
      where: {
        OR: [
          { id: primaryId },
          { linkedId: primaryId }
        ],
        deletedAt: null
      }
    });

    // 7️⃣ Check if new info exists
    const existingEmails = new Set(
      cluster.map(c => c.email).filter(Boolean)
    );

    const existingPhones = new Set(
      cluster.map(c => c.phoneNumber).filter(Boolean)
    );

    const isNewEmail = email && !existingEmails.has(email);
    const isNewPhone = phoneNumber && !existingPhones.has(phoneNumber);

    if (isNewEmail || isNewPhone) {
      await tx.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "secondary",
          linkedId: primaryId
        }
      });
    }

    // 8️⃣ Final cluster fetch
    const finalCluster = await tx.contact.findMany({
      where: {
        OR: [
          { id: primaryId },
          { linkedId: primaryId }
        ],
        deletedAt: null
      },
      orderBy: { createdAt: "asc" }
    });

    return buildResponse(finalCluster);
  });
}

function buildResponse(contacts) {
  const primary = contacts.find(c => c.linkPrecedence === "primary");
  const secondary = contacts.filter(c => c.linkPrecedence === "secondary");

  // Unique emails (primary first)
  const emails = [
    primary.email,
    ...secondary.map(s => s.email)
  ].filter(Boolean);

  const uniqueEmails = [...new Set(emails)];

  // Unique phones (primary first)
  const phones = [
    primary.phoneNumber,
    ...secondary.map(s => s.phoneNumber)
  ].filter(Boolean);

  const uniquePhones = [...new Set(phones)];

  return {
    contact: {
      primaryContatctId: primary.id,
      emails: uniqueEmails,
      phoneNumbers: uniquePhones,
      secondaryContactIds: secondary.map(s => s.id)
    }
  };
}

module.exports = { identifyContact };