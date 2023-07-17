import { Module } from '@nestjs/common';
import { BlockModule } from '../block/block.module';
import { BlockchainConfigModule } from '../blockchain-config/blockchain-config.module';
import { RedisModule } from '../redis/redis.module';
import { UpdaterService } from './updater.service';
import { HarvesterModule } from '../harvester/harvester.module';
import { CacheModule } from '../cache/cache.module';
import { LastProcessedBlockModule } from '../last-processed-block/last-processed-block.module';
import { QuoteModule } from '../quote/quote.module';
import { StrategyCreatedEventModule } from '../events/strategy-created-event/strategy-created-event.module';
import { TokenModule } from '../token/token.module';
import { PairModule } from '../pair/pair.module';
import { PairCreatedEventModule } from '../events/pair-created-event /pair-created-event.module';
import { StrategyModule } from '../strategy/strategy.module';
import { StrategyUpdatedEventModule } from '../events/strategy-updated-event/strategy-updated-event.module';

@Module({
  imports: [
    BlockModule,
    BlockchainConfigModule,
    RedisModule,
    HarvesterModule,
    CacheModule,
    LastProcessedBlockModule,
    QuoteModule,
    StrategyCreatedEventModule,
    TokenModule,
    PairModule,
    PairCreatedEventModule,
    StrategyModule,
    StrategyUpdatedEventModule,
  ],
  providers: [UpdaterService],
})
export class UpdaterModule {}
