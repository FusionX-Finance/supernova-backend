import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { decimalsABI, symbolABI } from '../abis/erc20.abi';
import { ConfigService } from '@nestjs/config';
import * as _ from 'lodash';
import { Token } from './token.entity';
import { HarvesterService } from '../harvester/harvester.service';
import { PairCreatedEvent } from '../events/pair-created-event /pair-created-event.entity';
import { LastProcessedBlockService } from '../last-processed-block/last-processed-block.service';
import { PairCreatedEventService } from '../events/pair-created-event /pair-created-event.service';

export interface TokensByAddress {
  [address: string]: Token;
}

const LAST_PROCESSED_ENTITY = 'tokens';

@Injectable()
export class TokenService {
  constructor(
    @InjectRepository(Token) private token: Repository<Token>,
    private harvesterService: HarvesterService,
    private configService: ConfigService,
    private lastProcessedBlockService: LastProcessedBlockService,
    private pairCreatedEventService: PairCreatedEventService,
  ) {}

  async update(endBlock: number): Promise<void> {
    // figure out start block
    const lastProcessedBlockNumber =
      await this.lastProcessedBlockService.getOrInit(LAST_PROCESSED_ENTITY, 1);

    // fetch pair created events
    const newEvents = await this.pairCreatedEventService.get(
      lastProcessedBlockNumber,
      endBlock,
    );

    // create new tokens
    const eventBatches = _.chunk(newEvents, 1000);
    for (const eventsBatch of eventBatches) {
      await this.createFromEvents(eventsBatch);
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

  async createFromEvents(events: PairCreatedEvent[]) {
    // map all token addresses in an array
    const eventsAddresses = new Set();
    events.forEach((e) => {
      eventsAddresses.add(e.token0);
      eventsAddresses.add(e.token1);
    });

    // filter out already existing tokens
    const currentlyExistingTokens: any = await this.token.find();
    const currentlyExistingAddresses = currentlyExistingTokens.map(
      (t) => t.address,
    );

    const newAddresses = [];
    Array.from(eventsAddresses).forEach((t) => {
      if (!currentlyExistingAddresses.includes(t)) {
        newAddresses.push(t);
      }
    });

    // fetch metadata
    const decimals = await this.getDecimals(newAddresses);
    const symbols = await this.getSymbols(newAddresses);

    // create new tokens
    const newTokens = [];
    for (let i = 0; i < newAddresses.length; i++) {
      newTokens.push(
        this.token.create({
          address: newAddresses[i],
          symbol: symbols[i],
          decimals: decimals[i],
        }),
      );
    }
    await this.token.save(newTokens);
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

  async allByAddress(): Promise<TokensByAddress> {
    const all = await this.token.find();
    const tokensByAddress = {};
    all.forEach((t) => (tokensByAddress[t.address] = t));
    return tokensByAddress;
  }
}
