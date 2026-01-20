-- CreateTable
CREATE TABLE `KecermatanRanking` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `kategoriSoalKecermatanId` INTEGER NOT NULL,
    `score` INTEGER NOT NULL,
    `totalSoal` INTEGER NOT NULL,
    `totalBenar` INTEGER NOT NULL,
    `totalSalah` INTEGER NOT NULL,
    `waktu` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KecermatanRanking_userId_fkey`(`userId`),
    INDEX `KecermatanRanking_kategoriSoalKecermatanId_fkey`(`kategoriSoalKecermatanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KecermatanRanking` ADD CONSTRAINT `KecermatanRanking_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KecermatanRanking` ADD CONSTRAINT `KecermatanRanking_kategoriSoalKecermatanId_fkey` FOREIGN KEY (`kategoriSoalKecermatanId`) REFERENCES `KategoriSoalKecermatan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
