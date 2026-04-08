import { Module } from '@nestjs/common';
import { TaskController } from './api/task.controller.js';

@Module({
  controllers: [TaskController],
  providers: [],
  exports: [],
})
export class TaskInboxModule {}
