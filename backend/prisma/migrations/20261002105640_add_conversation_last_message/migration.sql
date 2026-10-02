-- AlterTable
ALTER TABLE `Conversation` ADD COLUMN `lastMessageId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Conversation_lastMessageId_key` ON `Conversation`(`lastMessageId`);

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_lastMessageId_fkey` FOREIGN KEY (`lastMessageId`) REFERENCES `Message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
