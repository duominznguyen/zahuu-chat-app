-- AlterTable
ALTER TABLE `Message` ADD COLUMN `callId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('TEXT', 'IMAGE', 'VIDEO', 'FILE', 'STICKER', 'SYSTEM', 'CALL') NOT NULL;

-- CreateTable
CREATE TABLE `Call` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `activeConversationId` VARCHAR(191) NULL,
    `startedById` VARCHAR(191) NOT NULL,
    `type` ENUM('AUDIO', 'VIDEO') NOT NULL,
    `status` ENUM('RINGING', 'ONGOING', 'ENDED', 'MISSED', 'DECLINED') NOT NULL DEFAULT 'RINGING',
    `livekitRoomName` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Call_activeConversationId_key`(`activeConversationId`),
    UNIQUE INDEX `Call_livekitRoomName_key`(`livekitRoomName`),
    INDEX `Call_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `callId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `joinedAt` DATETIME(3) NULL,
    `leftAt` DATETIME(3) NULL,

    UNIQUE INDEX `CallParticipant_callId_userId_key`(`callId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Message_callId_key` ON `Message`(`callId`);

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_callId_fkey` FOREIGN KEY (`callId`) REFERENCES `Call`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Call` ADD CONSTRAINT `Call_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Call` ADD CONSTRAINT `Call_startedById_fkey` FOREIGN KEY (`startedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallParticipant` ADD CONSTRAINT `CallParticipant_callId_fkey` FOREIGN KEY (`callId`) REFERENCES `Call`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallParticipant` ADD CONSTRAINT `CallParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

