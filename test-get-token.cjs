const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findUnique({ where: { email: 'test@test.com' } }).then(u => {
  if (u) console.log('verifyToken:', u.verifyToken);
  else console.log('user not found');
  p.$disconnect();
});
