const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeRoles } = require('#middlewares');

const paymentGatewayRouter = require('#api/payment-gateway/route.js');
const authRouter = require('#api/auth/route.js');
const fileRouter = require('#api/file/route.js');
const manageUserRouter = require('#api/manage-user/route.js');
const voucherRouter = require('#api/voucher/route.js');
const bankSoalCategoryRouter = require('#api/bank-soal-kategori/route.js');
const bankSoalParentCategoryRouter = require('#api/bank-soal-parent-kategori/route.js');
const bankSoalRouter = require('#api/bank-soal/route.js');
const kategoriPaketRouter = require('#api/paket-kategori/route.js');
const subKategoriPaketRouter = require('#api/paket-sub-kategori/route.js');
const paketLatihanRouter = require('#api/paket-latihan/route.js');
const paketLatihanSoalRouter = require('#api/paket-latihan-soal/route.js');
const paketPembelianRouter = require('#api/paket-pembelian/route.js');
const paketPembelianMateriRouter = require('#api/paket-pembelian-materi/route.js');
const paketPembelianBimbelRouter = require('#api/paket-pembelian-bimbel/route.js');
const paketPembelianFiturRouter = require('#api/paket-pembelian-fitur/route.js');
const paketPembelianTryoutRouter = require('#api/paket-pembelian-tryout/route.js');
const sectionHomeRouter = require('#api/home-section/route.js');
const notificationRouter = require('#api/notification/route.js');
const userRouter = require('#api/user/route.js');
const tryoutRouter = require('#api/tryout/route.js');
const dashboardRouter = require('#api/dashboard/route.js');
const eventRouter = require('#api/event/route.js');
const eventUserRouter = require('#api/event/route.user.js');
const paketPembelianUserRouter = require('#api/paket-pembelian/route-user.js');
const notificationUserRouter = require('#api/notification/route.user.js');
const ticketRouter = require('#api/ticket/route.js');
const dashboardNotificationRouter = require('#api/dashboard-notification/route.js');
const feedbackRouter = require('#api/feedback/route.js');
const affiliateRouter = require('#api/affiliate/route.js');
const kategoriSoalKecermatanRouter = require('#api/kategori-soal-kecermatan/route.js');
const kiasanRouter = require('#api/kiasan/route.js');
const soalKecermatanRouter = require('#api/soal-kecermatan/route.js');
const paketPembelianKecermatanRouter = require('#api/paket-pembelian-kecermatan/route.js'); 

const database = require('#database');

router.get('/reset-all', async (req, res) => {
  await database.pembelian.updateMany({
    where: {
      id: {
        gt: 0,
      },
    },
    data: { duration: 12 },
  });
  res.send('Reset All');
});

router.use('/api/file', fileRouter);
router.use('/api/auth', authRouter);
router.use('/api/dashboard', dashboardRouter);
router.use('/api/dashboard-notification', dashboardNotificationRouter);

// User routes
router.use('/api/user/payment-gateway', paymentGatewayRouter);
router.use('/api/user', authenticateUser, userRouter);
router.use('/api/user/tryout', tryoutRouter);
router.use('/api/user/paket-pembelian', paketPembelianUserRouter);
router.use('/api/user/event', eventUserRouter);
router.use('/api/user/notification', notificationUserRouter);
router.use('/api/user', feedbackRouter); // User feedback routes
router.use('/api/user', affiliateRouter);
router.use('/api/user/paket-pembelian-kecermatan', authenticateUser, paketPembelianKecermatanRouter);

//router.use('/api/user/tickets', authenticateUser, ticketRouter); // User ticket routes

// Admin routes
router.use('/api/admin/bank-soal', bankSoalRouter);
router.use('/api/admin/paket-pembelian-tryout', paketPembelianTryoutRouter);
router.use('/api/admin/ticket', ticketRouter); 

router.use('/api/admin', feedbackRouter); // Admin feedback routes
router.use('/api/admin', feedbackRouter); // Admin feedback settings routes
router.use('/api/admin', affiliateRouter);
router.use('/api/admin/kategori-soal-kecermatan', kategoriSoalKecermatanRouter);
router.use('/api/admin/kiasan', kiasanRouter);
router.use('/api/admin/soal-kecermatan', soalKecermatanRouter);

router.use('/api/admin', authenticateUser, authorizeRoles('ADMIN'));
router.use('/api/admin/users', manageUserRouter);
router.use('/api/admin/vouchers', voucherRouter);
router.use('/api/admin/bank-soal-parent-kategori', bankSoalParentCategoryRouter);
router.use('/api/admin/bank-soal-kategori', bankSoalCategoryRouter);
router.use('/api/admin/paket-kategori', kategoriPaketRouter);
router.use('/api/admin/paket-sub-kategori', subKategoriPaketRouter);
router.use('/api/admin/paket-latihan', paketLatihanRouter);
router.use('/api/admin/paket-latihan-soal', paketLatihanSoalRouter);
router.use('/api/admin/paket-pembelian', paketPembelianRouter);
router.use('/api/admin/paket-pembelian-materi', paketPembelianMateriRouter);
router.use('/api/admin/paket-pembelian-bimbel', paketPembelianBimbelRouter);
router.use('/api/admin/paket-pembelian-fitur', paketPembelianFiturRouter);
router.use('/api/admin/paket-pembelian-kecermatan', paketPembelianKecermatanRouter);
router.use('/api/admin/event', eventRouter);
router.use('/api/admin/home-section', sectionHomeRouter);
router.use('/api/admin/notification', notificationRouter);

module.exports = router;