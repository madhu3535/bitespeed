const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function identifyContact(email, phoneNumber) {
  if (!email && !phoneNumber) {
    throw new Error("At least one of email or phoneNumber is required");
  }

  return prisma.$transaction(async (tx) => {

    const matches = await tx.contact.findMany({
      where: {
        OR: [
          email ? { email } : undefined,
          phoneNumber ? { phoneNumber } : undefined
        ].filter(Boolean),
        deletedAt: null
      },
      orderBy: { createdAt: "asc" }
    });

    if (matches.length === 0) {
      const newContact = await tx.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "primary"
        }
      });

      return buildResponse([newContact]);
    }

    const primary = matches
      .filter(c => c.linkPrecedence === "primary")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];

    const primaryId = primary.linkedId || primary.id;

    const allContacts = await tx.contact.findMany({
      where: {
        OR: [
          { id: primaryId },
          { linkedId: primaryId }
        ],
        deletedAt: null
      }
    });

    const emails = new Set(allContacts.map(c => c.email).filter(Boolean));
    const phones = new Set(allContacts.map(c => c.phoneNumber).filter(Boolean));

    const isNewEmail = email && !emails.has(email);
    const isNewPhone = phoneNumber && !phones.has(phoneNumber);

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

    const finalContacts = await tx.contact.findMany({
      where: {
        OR: [
          { id: primaryId },
          { linkedId: primaryId }
        ],
        deletedAt: null
      }
    });

    return buildResponse(finalContacts);
  });
}

function buildResponse(contacts) {
  const primary = contacts.find(c => c.linkPrecedence === "primary");
  const secondary = contacts.filter(c => c.linkPrecedence === "secondary");

  return {
    contact: {
      primaryContatctId: primary.id,
      emails: [
        primary.email,
        ...secondary.map(s => s.email)
      ].filter(Boolean),
      phoneNumbers: [
        primary.phoneNumber,
        ...secondary.map(s => s.phoneNumber)
      ].filter(Boolean),
      secondaryContactIds: secondary.map(s => s.id)
    }
  };
}

module.exports = { identifyContact };