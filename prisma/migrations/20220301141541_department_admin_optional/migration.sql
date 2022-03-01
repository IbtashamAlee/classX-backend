-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_adminId_fkey";

-- AlterTable
ALTER TABLE "Department" ALTER COLUMN "adminId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
