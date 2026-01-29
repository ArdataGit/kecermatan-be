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
const paketPembelianBacaanRouter = require('#api/paket-pembelian-bacaan/route.js');
const paketPembelianIsianRouter = require('#api/paket-pembelian-isian/route.js');
const bacaanRouter = require('#api/bacaan/route.js');
const kategoriSoalBacaanRouter = require('#api/kategori-soal-bacaan/route.js');
const kategoriSoalIsianRouter = require('#api/kategori-soal-isian/route.js');
const soalIsianRouter = require('#api/soal-isian/route.js');
const soalBacaanRouter = require('#api/soal-bacaan/route.js');
const latihanKiasanRouter = require('#api/latihan-kiasan/route.js');
const kategoriLatihanKecermatanRouter = require('#api/kategori-latihan-kecermatan/route.js');

// User Routers for Bacaan
const kategoriSoalBacaanUserRouter = require('#api/kategori-soal-bacaan/route.user.js');
const bacaanUserRouter = require('#api/bacaan/route.user.js');
const historyBacaanUserRouter = require('#api/history-bacaan/route.user.js');

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
router.use('/api/user/kategori-soal-bacaan', authenticateUser, kategoriSoalBacaanUserRouter); // Maps to route.user.js
router.use('/api/user/bacaan', authenticateUser, bacaanUserRouter); // Maps to route.user.js
router.use('/api/user/history-bacaan', authenticateUser, historyBacaanUserRouter);

const kategoriSoalIsianUserRouter = require('#api/kategori-soal-isian/route.user.js');
const soalIsianUserRouter = require('#api/soal-isian/route.user.js');
const historyIsianUserRouter = require('#api/history-isian/route.user.js');

router.use('/api/user/tickets', authenticateUser, ticketRouter); // User ticket routes
router.use('/api/user/kategori-soal-isian', authenticateUser, kategoriSoalIsianUserRouter);
router.use('/api/user/soal-isian', authenticateUser, soalIsianUserRouter);
router.use('/api/user/history-isian', authenticateUser, historyIsianUserRouter);

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
router.use('/api/admin/bacaan', bacaanRouter);
router.use('/api/admin/kategori-soal-bacaan', kategoriSoalBacaanRouter);
router.use('/api/admin/soal-bacaan', soalBacaanRouter);
router.use('/api/admin/kategori-soal-isian', kategoriSoalIsianRouter);
router.use('/api/admin/soal-isian', soalIsianRouter);
router.use('/api/latihan-kiasan', authenticateUser, latihanKiasanRouter);
router.use('/api/kategori-latihan-kecermatan', authenticateUser, kategoriLatihanKecermatanRouter);

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
router.use('/api/admin/paket-pembelian-bacaan', paketPembelianBacaanRouter);
router.use('/api/admin/paket-pembelian-isian', paketPembelianIsianRouter);
router.use('/api/admin/event', eventRouter);
router.use('/api/admin/home-section', sectionHomeRouter);
router.use('/api/admin/notification', notificationRouter);

module.exports = router;