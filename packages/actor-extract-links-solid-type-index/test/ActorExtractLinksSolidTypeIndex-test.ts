import type { Readable } from 'stream';
import type { ActorInitQuery } from '@comunica/actor-init-query';
import { BindingsFactory } from '@comunica/bindings-factory';
import type { MediatorDereferenceRdf } from '@comunica/bus-dereference-rdf';
import { KeysInitQuery, KeysQueryOperation } from '@comunica/context-entries';
import { ActionContext, Bus } from '@comunica/core';
import { ArrayIterator } from 'asynciterator';
import { DataFactory } from 'rdf-data-factory';
import { Factory as AlgebraFactory } from 'sparqlalgebrajs';
import { ActorExtractLinksSolidTypeIndex } from '../lib/ActorExtractLinksSolidTypeIndex';
const quad = require('rdf-quad');
const stream = require('streamify-array');

const DF = new DataFactory();
const BF = new BindingsFactory();
const AF = new AlgebraFactory();

describe('ActorExtractLinksSolidTypeIndex', () => {
  let bus: any;
  let mediatorDereferenceRdf: MediatorDereferenceRdf;
  let actorInitQuery: ActorInitQuery;
  let input: Readable;
  let context: ActionContext;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
    mediatorDereferenceRdf = <any> {
      mediate: jest.fn(async() => ({
        data: new ArrayIterator([], { autoStart: false }),
      })),
    };
    actorInitQuery = <any> {};
    input = stream([]);
    context = new ActionContext({
      [KeysInitQuery.query.name]: AF.createBgp([
        AF.createPattern(
          DF.variable('s'),
          DF.namedNode(ActorExtractLinksSolidTypeIndex.RDF_TYPE),
          DF.namedNode('ex:class1'),
        ),
        AF.createPattern(DF.variable('s'), DF.namedNode('ex:p'), DF.namedNode('ex:bla')),
      ]),
      [KeysQueryOperation.operation.name]: AF.createPattern(
        DF.variable('s'),
        DF.namedNode('ex:p'),
        DF.namedNode('ex:bla'),
      ),
    });
  });

  describe('An ActorExtractLinksSolidTypeIndex instance with onlyMatchingTypes: false', () => {
    let actor: ActorExtractLinksSolidTypeIndex;

    beforeEach(() => {
      actor = new ActorExtractLinksSolidTypeIndex({
        name: 'actor',
        bus,
        typeIndexPredicates: [
          'ex:typeIndex1',
          'ex:typeIndex2',
        ],
        onlyMatchingTypes: false,
        mediatorDereferenceRdf,
        actorInitQuery,
      });
      (<any> actor).queryEngine = {
        queryBindings: jest.fn(async() => ({
          toArray: async() => [
            BF.fromRecord({ instance: DF.namedNode('ex:file1'), class: DF.namedNode('ex:class1') }),
            BF.fromRecord({ instance: DF.namedNode('ex:file2'), class: DF.namedNode('ex:class2') }),
          ],
        })),
      };
    });

    describe('test', () => {
      it('should reject for an empty context', () => {
        return expect(actor.test(<any> { context: new ActionContext() })).rejects
          .toThrowError('Actor actor can only work in the context of a query.');
      });

      it('should reject for a context without query operation', () => {
        return expect(actor.test(<any> {
          context: new ActionContext({
            [KeysInitQuery.query.name]: {},
          }),
        })).rejects.toThrowError('Actor actor can only work in the context of a query operation.');
      });

      it('should reject for a context without query', () => {
        return expect(actor.test(<any> {
          context: new ActionContext({
            [KeysQueryOperation.operation.name]: {},
          }),
        })).rejects.toThrowError('Actor actor can only work in the context of a query.');
      });

      it('should be true for a valid context', () => {
        return expect(actor.test(<any> { context })).resolves.toBeTruthy();
      });
    });

    it('should run on an empty stream', () => {
      return expect(actor.run({ url: '', metadata: input, requestTime: 0, context })).resolves
        .toEqual({
          links: [],
        });
    });

    it('should run on a stream without type index predicates', () => {
      input = stream([
        quad('ex:s1', 'ex:px', 'ex:o1', 'ex:gx'),
        quad('ex:s2', 'ex:p', '"o"', 'ex:g'),
        quad('ex:s3', 'ex:px', 'ex:o3', 'ex:gx'),
        quad('ex:s4', 'ex:p', 'ex:o4', 'ex:g'),
        quad('ex:s5', 'ex:p', 'ex:o5', 'ex:gx'),
      ]);
      return expect(actor.run({ url: '', metadata: input, requestTime: 0, context })).resolves
        .toEqual({
          links: [],
        });
    });

    it('should run on a stream with type index predicates', async() => {
      input = stream([
        quad('ex:s1', 'ex:typeIndex1', 'ex:index1'),
        quad('ex:s2', 'ex:typeIndex2', 'ex:index2'),
        quad('ex:s3', 'ex:px', 'ex:o3', 'ex:gx'),
        quad('ex:s4', 'ex:p', 'ex:o4', 'ex:g'),
        quad('ex:s5', 'ex:p', 'ex:o5', 'ex:gx'),
      ]);
      await expect(actor.run({ url: '', metadata: input, requestTime: 0, context })).resolves
        .toEqual({
          links: [
            {
              url: 'ex:file1',
            },
            {
              url: 'ex:file1',
            },
            {
              url: 'ex:file2',
            },
            {
              url: 'ex:file2',
            },
          ],
        });

      expect(mediatorDereferenceRdf.mediate).toHaveBeenCalledTimes(2);
      expect(mediatorDereferenceRdf.mediate).toHaveBeenCalledWith({ url: 'ex:index1', context });
      expect(mediatorDereferenceRdf.mediate).toHaveBeenCalledWith({ url: 'ex:index2', context });
    });
  });

  describe('An ActorExtractLinksSolidTypeIndex instance with onlyMatchingTypes: true', () => {
    let actor: ActorExtractLinksSolidTypeIndex;

    beforeEach(() => {
      actor = new ActorExtractLinksSolidTypeIndex({
        name: 'actor',
        bus,
        typeIndexPredicates: [
          'ex:typeIndex1',
          'ex:typeIndex2',
        ],
        onlyMatchingTypes: true,
        mediatorDereferenceRdf,
        actorInitQuery,
      });
      (<any> actor).queryEngine = {
        queryBindings: jest.fn(async() => ({
          toArray: async() => [
            BF.fromRecord({ instance: DF.namedNode('ex:file1'), class: DF.namedNode('ex:class1') }),
            BF.fromRecord({ instance: DF.namedNode('ex:file2'), class: DF.namedNode('ex:class2') }),
          ],
        })),
      };
    });

    it('should run on a stream without type index predicates', () => {
      input = stream([
        quad('ex:s1', 'ex:px', 'ex:o1', 'ex:gx'),
        quad('ex:s2', 'ex:p', '"o"', 'ex:g'),
        quad('ex:s3', 'ex:px', 'ex:o3', 'ex:gx'),
        quad('ex:s4', 'ex:p', 'ex:o4', 'ex:g'),
        quad('ex:s5', 'ex:p', 'ex:o5', 'ex:gx'),
      ]);
      return expect(actor.run({ url: '', metadata: input, requestTime: 0, context })).resolves
        .toEqual({
          links: [],
        });
    });

    it('should run on a stream with type index predicates', async() => {
      input = stream([
        quad('ex:s1', 'ex:typeIndex1', 'ex:index1'),
        quad('ex:s3', 'ex:px', 'ex:o3', 'ex:gx'),
        quad('ex:s4', 'ex:p', 'ex:o4', 'ex:g'),
        quad('ex:s5', 'ex:p', 'ex:o5', 'ex:gx'),
      ]);
      await expect(actor.run({ url: '', metadata: input, requestTime: 0, context })).resolves
        .toEqual({
          links: [
            {
              url: 'ex:file1',
            },
          ],
        });

      expect(mediatorDereferenceRdf.mediate).toHaveBeenCalledTimes(1);
      expect(mediatorDereferenceRdf.mediate).toHaveBeenCalledWith({ url: 'ex:index1', context });
    });

    it('should run on a stream with type index predicates for a non-matching query', async() => {
      input = stream([
        quad('ex:s1', 'ex:typeIndex1', 'ex:index1'),
        quad('ex:s3', 'ex:px', 'ex:o3', 'ex:gx'),
        quad('ex:s4', 'ex:p', 'ex:o4', 'ex:g'),
        quad('ex:s5', 'ex:p', 'ex:o5', 'ex:gx'),
      ]);
      context = new ActionContext({
        [KeysInitQuery.query.name]: AF.createBgp([
          AF.createPattern(
            DF.variable('s'),
            DF.namedNode(ActorExtractLinksSolidTypeIndex.RDF_TYPE),
            DF.namedNode('ex:class3'),
          ),
          AF.createPattern(DF.variable('s'), DF.namedNode('ex:p'), DF.namedNode('ex:bla')),
        ]),
        [KeysQueryOperation.operation.name]: AF.createPattern(
          DF.variable('s'),
          DF.namedNode('ex:p'),
          DF.namedNode('ex:bla'),
        ),
      });
      await expect(actor.run({ url: '', metadata: input, requestTime: 0, context })).resolves
        .toEqual({
          links: [],
        });

      expect(mediatorDereferenceRdf.mediate).toHaveBeenCalledTimes(1);
      expect(mediatorDereferenceRdf.mediate).toHaveBeenCalledWith({ url: 'ex:index1', context });
    });
  });
});
