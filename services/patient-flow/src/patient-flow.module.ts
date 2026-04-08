import { Module } from '@nestjs/common';
import { PatientFlowController } from './api/patient-flow.controller.js';

@Module({
  controllers: [PatientFlowController],
  providers: [],
  exports: [],
})
export class PatientFlowModule {}
