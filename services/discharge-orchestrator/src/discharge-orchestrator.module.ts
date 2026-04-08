import { Module } from '@nestjs/common';
import { DischargeController } from './api/discharge.controller.js';

@Module({
  controllers: [DischargeController],
  providers: [],
  exports: [],
})
export class DischargeOrchestratorModule {}
