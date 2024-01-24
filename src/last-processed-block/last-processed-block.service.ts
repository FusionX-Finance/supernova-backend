import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LastProcessedBlock } from './last-processed-block.entity';

@Injectable()
export class LastProcessedBlockService {
  constructor(
    @InjectRepository(LastProcessedBlock)
    private lastProcessedBlock: Repository<LastProcessedBlock>,
    private configService: ConfigService,
  ) {}

  // caches the last processed block id if it is in fact greater than the previous processed block id.
  async update(param: string, blockId: number): Promise<any> {
    let lastProcessed = await this.lastProcessedBlock.findOneBy({ param });
    if (!lastProcessed) {
      lastProcessed = this.lastProcessedBlock.create({
        param,
        block: { id: blockId },
      });
      await this.lastProcessedBlock.save(lastProcessed);
    } else if (blockId > lastProcessed.block.id) {
      await this.lastProcessedBlock.update(lastProcessed.id, {
        block: { id: blockId },
      });
    }
  }

  async get(param: string): Promise<number> {
    const lastProcessed = await this.lastProcessedBlock.findOneBy({ param });
    return lastProcessed ? lastProcessed.block.id : null;
  }
  async getOrInit(param: string, initTo?: number): Promise<number> {
    const _initTo = initTo || this.configService.get('START_BLOCK') - 1;
    const lastProcessed = await this.lastProcessedBlock.findOneBy({ param });
    return lastProcessed ? lastProcessed.block.id : _initTo;
  }

  async firstUnprocessedBlockNumber(): Promise<number> {
    const startBlock = parseInt(this.configService.get('START_BLOCK'));
    const entities = [
      'block',
      'pair-created-events',
      'strategy-created-events',
      'trading-fee-ppm-updated-events',
      'pair-trading-fee-ppm-updated',
      'voucher-transfer-events',
    ];
    const values = await Promise.all(
      entities.map((e) => {
        return this.getOrInit(e, startBlock);
      }),
    );

    return Math.min(...values);
  }
}
