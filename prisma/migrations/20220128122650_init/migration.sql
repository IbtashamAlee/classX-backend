-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userStatus" TEXT,
    "imageURL" VARCHAR(255),
    "last_login" TIMESTAMPTZ(6) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailToken" VARCHAR(255),
    "resetToken" VARCHAR(255),
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "ipv4Address" VARCHAR(15) NOT NULL,
    "ipv6Address" VARCHAR(39) NOT NULL,
    "device_model" VARCHAR(255) NOT NULL,
    "browser_version" VARCHAR(255) NOT NULL,
    "browser_family" VARCHAR(255) NOT NULL,
    "os_family" VARCHAR(255) NOT NULL,
    "os_version" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "uploadedBy" INTEGER NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institute" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "adminId" INTEGER NOT NULL,
    "instituteType" VARCHAR(255) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Institute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "instituteId" INTEGER NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),
    "adminId" INTEGER NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstituteRequest" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "instituteType" VARCHAR(255) NOT NULL,
    "adminId" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6),
    "rejectedAt" TIMESTAMPTZ(6),

    CONSTRAINT "InstituteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstituteRequestAttachment" (
    "id" SERIAL NOT NULL,
    "instituteRequestId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "InstituteRequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "code" VARCHAR(255) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassParticipants" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "ClassParticipants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassPost" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "startingTime" TIMESTAMPTZ(6) NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostAttachments" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostAttachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostComments" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostComments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassPoll" (
    "id" SERIAL NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "startingTime" TIMESTAMPTZ(6) NOT NULL,
    "statment" TEXT NOT NULL,
    "classId" INTEGER NOT NULL,
    "deletedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ClassPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollComments" (
    "id" SERIAL NOT NULL,
    "pollId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PollComments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" SERIAL NOT NULL,
    "pollId" INTEGER NOT NULL,
    "option" TEXT NOT NULL,
    "votes" INTEGER NOT NULL,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOptionSelection" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "pollOptionId" INTEGER NOT NULL,

    CONSTRAINT "PollOptionSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" SERIAL NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "body" TEXT,
    "deletedAt" TIMESTAMPTZ(6),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" SERIAL NOT NULL,
    "statment" TEXT NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "questionScore" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "deletedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "deletedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionResponse" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "userSessionId" INTEGER NOT NULL,
    "classAssessmentId" INTEGER NOT NULL,
    "obtainedScore" INTEGER NOT NULL,

    CONSTRAINT "QuestionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAttachment" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,

    CONSTRAINT "QuestionAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseAttachment" (
    "id" SERIAL NOT NULL,
    "questionResponseId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,

    CONSTRAINT "ResponseAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAssessment" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "deletedAt" TIMESTAMPTZ(6) NOT NULL,
    "allowResubmission" BOOLEAN NOT NULL,
    "startingTime" TIMESTAMPTZ(6) NOT NULL,
    "isMultiTimer" BOOLEAN NOT NULL,
    "QuestionsToDisplay" INTEGER NOT NULL,

    CONSTRAINT "ClassAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAssessmentComments" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ClassAssessmentComments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAttendance" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "startingTime" TIMESTAMPTZ(6) NOT NULL,
    "endingTime" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ClassAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" SERIAL NOT NULL,
    "classAttendanceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "isPresent" BOOLEAN NOT NULL,
    "userSessionId" INTEGER NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatParticipants" (
    "id" SERIAL NOT NULL,
    "chatId" INTEGER NOT NULL,
    "participantId" INTEGER NOT NULL,
    "removedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ChatParticipants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "chatId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "timeSent" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6) NOT NULL,
    "fileId" INTEGER,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notifications" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "time_sent" TIMESTAMPTZ(6) NOT NULL,
    "is_read" BOOLEAN NOT NULL,

    CONSTRAINT "Notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "classId" INTEGER,
    "departmentId" INTEGER,
    "instituteId" INTEGER,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(255) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Institute_name_key" ON "Institute"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_fileId_key" ON "ChatMessage"("fileId");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Institute" ADD CONSTRAINT "Institute_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteRequest" ADD CONSTRAINT "InstituteRequest_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteRequestAttachment" ADD CONSTRAINT "InstituteRequestAttachment_instituteRequestId_fkey" FOREIGN KEY ("instituteRequestId") REFERENCES "InstituteRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteRequestAttachment" ADD CONSTRAINT "InstituteRequestAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassParticipants" ADD CONSTRAINT "ClassParticipants_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassParticipants" ADD CONSTRAINT "ClassParticipants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPost" ADD CONSTRAINT "ClassPost_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPost" ADD CONSTRAINT "ClassPost_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostAttachments" ADD CONSTRAINT "PostAttachments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ClassPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostAttachments" ADD CONSTRAINT "PostAttachments_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComments" ADD CONSTRAINT "PostComments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ClassPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComments" ADD CONSTRAINT "PostComments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPoll" ADD CONSTRAINT "ClassPoll_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPoll" ADD CONSTRAINT "ClassPoll_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollComments" ADD CONSTRAINT "PollComments_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ClassPoll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollComments" ADD CONSTRAINT "PollComments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ClassPoll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOptionSelection" ADD CONSTRAINT "PollOptionSelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOptionSelection" ADD CONSTRAINT "PollOptionSelection_pollOptionId_fkey" FOREIGN KEY ("pollOptionId") REFERENCES "PollOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponse" ADD CONSTRAINT "QuestionResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponse" ADD CONSTRAINT "QuestionResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponse" ADD CONSTRAINT "QuestionResponse_userSessionId_fkey" FOREIGN KEY ("userSessionId") REFERENCES "UserSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponse" ADD CONSTRAINT "QuestionResponse_classAssessmentId_fkey" FOREIGN KEY ("classAssessmentId") REFERENCES "ClassAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttachment" ADD CONSTRAINT "QuestionAttachment_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttachment" ADD CONSTRAINT "QuestionAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseAttachment" ADD CONSTRAINT "ResponseAttachment_questionResponseId_fkey" FOREIGN KEY ("questionResponseId") REFERENCES "QuestionResponse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseAttachment" ADD CONSTRAINT "ResponseAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssessment" ADD CONSTRAINT "ClassAssessment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssessment" ADD CONSTRAINT "ClassAssessment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssessmentComments" ADD CONSTRAINT "ClassAssessmentComments_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ClassAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssessmentComments" ADD CONSTRAINT "ClassAssessmentComments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAttendance" ADD CONSTRAINT "ClassAttendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAttendance" ADD CONSTRAINT "ClassAttendance_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_classAttendanceId_fkey" FOREIGN KEY ("classAttendanceId") REFERENCES "ClassAttendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userSessionId_fkey" FOREIGN KEY ("userSessionId") REFERENCES "UserSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatParticipants" ADD CONSTRAINT "ChatParticipants_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatParticipants" ADD CONSTRAINT "ChatParticipants_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
