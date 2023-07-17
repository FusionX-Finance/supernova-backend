import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Pair } from './pair.entity';
import { HarvesterService } from '../harvester/harvester.service';
import { decimalsABI, symbolABI } from '../abis/erc20.abi';
import { ConfigService } from '@nestjs/config';
import { PairCreatedEvent } from '../events/pair-created-event /pair-created-event.entity';
import { TokensByAddress } from '../token/token.service';
import { LastProcessedBlockService } from '../last-processed-block/last-processed-block.service';
import { PairCreatedEventService } from '../events/pair-created-event /pair-created-event.service';
import * as _ from 'lodash';

interface PairDictionaryItem {
  [address: string]: Pair;
}
export interface PairsDictionary {
  [address: string]: PairDictionaryItem;
}

const LAST_PROCESSED_ENTITY = 'pairs';

@Injectable()
export class PairService {
  constructor(
    @InjectRepository(Pair) private pair: Repository<Pair>,
    private harvesterService: HarvesterService,
    private configService: ConfigService,
    private lastProcessedBlockService: LastProcessedBlockService,
    private pairCreatedEventService: PairCreatedEventService,
  ) {}

  async update(endBlock: number, tokens: TokensByAddress): Promise<void> {
    // figure out start block
    const lastProcessedBlockNumber =
      await this.lastProcessedBlockService.getOrInit(LAST_PROCESSED_ENTITY, 1);

    // fetch pair created events
    const newEvents = await this.pairCreatedEventService.get(
      lastProcessedBlockNumber,
      endBlock,
    );

    // create new pairs
    const eventBatches = _.chunk(newEvents, 1000);
    for (const eventsBatch of eventBatches) {
      await this.createFromEvents(eventsBatch, tokens);
      await this.lastProcessedBlockService.update(
        LAST_PROCESSED_ENTITY,
        eventsBatch[eventsBatch.length - 1].block.id,
      );
    }

    // update last processed block number
    await this.lastProcessedBlockService.update(
      LAST_PROCESSED_ENTITY,
      endBlock,
    );
  }

  async createFromEvents(events: PairCreatedEvent[], tokens: TokensByAddress) {
    const pairs = [];
    events.forEach((e) => {
      pairs.push(
        this.pair.create({
          token0: tokens[e.token0],
          token1: tokens[e.token1],
          name: `${tokens[e.token0].symbol}_${tokens[e.token1].symbol}`,
        }),
      );
    });

    await this.pair.save(pairs);
  }

  async getSymbols(addresses: string[]): Promise<string[]> {
    const symbols = await this.harvesterService.stringsWithMulticall(
      addresses,
      symbolABI,
      'symbol',
    );
    const eth = this.configService.get('ETH');
    const index = addresses.indexOf(eth);
    if (index >= 0) {
      symbols[index] = 'ETH';
    }
    return symbols;
  }

  async getDecimals(addresses: string[]): Promise<number[]> {
    const decimals = await this.harvesterService.integersWithMulticall(
      addresses,
      decimalsABI,
      'decimals',
    );
    const index = addresses.indexOf(this.configService.get('ETH'));
    if (index >= 0) {
      decimals[index] = 18;
    }
    return decimals;
  }

  async all(): Promise<Pair[]> {
    return this.pair
      .createQueryBuilder('pools')
      .leftJoinAndSelect('pools.block', 'block')
      .leftJoinAndSelect('pools.token0', 'token0')
      .leftJoinAndSelect('pools.token1', 'token1')
      .getMany();
  }

  async allAsDictionary(): Promise<PairsDictionary> {
    const all = await this.all();
    const dictionary = {};
    all.forEach((p) => {
      if (!(p.token0.address in dictionary)) {
        dictionary[p.token0.address] = {};
      }
      if (!(p.token1.address in dictionary)) {
        dictionary[p.token1.address] = {};
      }
      dictionary[p.token0.address][p.token1.address] = p;
      dictionary[p.token1.address][p.token0.address] = p;
    });
    return dictionary;
  }
}
