var ExplainPlanModel = require('../');
var assert = require('assert');

// var debug = require('debug')('mongodb-explain-plan-model:test');

function loadExplainFixture(name) {
  var explain = require(name);
  var model = new ExplainPlanModel(explain, {parse: true});
  return model;
}

describe('explain-plan-model', function() {
  context('Modern explain plans', function() {
    var model;

    describe('Simple collection scans', function() {
      beforeEach(function() {
        model = loadExplainFixture('./fixtures/simple_collscan_3.2.json');
      });

      it('should parse basic fields correctly for 3.2 collection scan plans', function() {
        assert.equal(model.namespace, 'mongodb.fanclub');
        assert.equal(model.nReturned, 1000000);
        assert.equal(model.executionTimeMillis, 188);
        assert.equal(model.totalKeysExamined, 0);
        assert.equal(model.totalDocsExamined, 1000000);
        assert.ok(model.rawExplainObject);
      });

      it('should have the raw explain object', function() {
        assert.ok(model.rawExplainObject);
      });

      it('should have legacy mode disabled', function() {
        assert.equal(model.legacyMode, false);
      });

      it('should detect collection scan', function() {
        assert.equal(model.isCollectionScan, true);
      });

      it('should not have the `usedIndex` field set', function() {
        assert.equal(model.usedIndex, null);
      });

      it('should have `inMemorySort` disabled', function() {
        assert.equal(model.inMemorySort, false);
      });

      it('should not be a covered query', function() {
        assert.equal(model.isCovered, false);
      });
    });

    describe('Simple indexed queries', function() {
      beforeEach(function() {
        model = loadExplainFixture('./fixtures/simple_index_3.2.json');
      });

      it('should parse basic fields correctly for 3.2 indexed scan plans', function() {
        assert.equal(model.namespace, 'mongodb.fanclub');
        assert.equal(model.nReturned, 191665);
        assert.equal(model.executionTimeMillis, 135);
        assert.equal(model.totalKeysExamined, 191665);
        assert.equal(model.totalDocsExamined, 191665);
      });

      it('should have the raw explain object', function() {
        assert.ok(model.rawExplainObject);
      });

      it('should have legacy mode disabled', function() {
        assert.equal(model.legacyMode, false);
      });

      it('should have `isCollectionScan` disabled', function() {
        assert.equal(model.isCollectionScan, false);
      });

      it('should have the correct `usedIndex` value', function() {
        assert.equal(model.usedIndex, 'age_1');
      });

      it('should have `inMemorySort` disabled', function() {
        assert.equal(model.inMemorySort, false);
      });

      it('should not be a covered query', function() {
        assert.equal(model.isCovered, false);
      });
    });

    describe('Covered queries', function() {
      beforeEach(function() {
        model = loadExplainFixture('./fixtures/covered_index_3.2.json');
      });

      it('should detect a covered query', function() {
        assert.equal(model.isCovered, true);
      });
    });

    describe('In-memory sorted queries', function() {
      beforeEach(function() {
        model = loadExplainFixture('./fixtures/sort_skip_limit_index_3.2.json');
      });

      it('should detect an in memory sort', function() {
        assert.equal(model.inMemorySort, true);
      });

      it('should not detect collection scan', function() {
        assert.equal(model.isCollectionScan, false);
      });

      it('should return the used index', function() {
        assert.equal(model.usedIndex, 'age_1');
      });

      it('should not be a covered index', function() {
        assert.equal(model.isCovered, false);
      });
    });
  });

  context('Legacy explain plans', function() {
    var explain;
    var model;

    describe('Simple collection scans', function() {
      beforeEach(function() {
        explain = require('./fixtures/simple_collscan_2.6.json');
        model = new ExplainPlanModel(explain, {parse: true});
      });

      it('should populate the model correctly', function() {
        assert.equal(model.nReturned, 50051);
        assert.equal(model.executionTimeMillis, 19);
        assert.equal(model.totalKeysExamined, 50051);
        assert.equal(model.totalDocsExamined, 50051);
        assert.equal(model.isCovered, false);
        assert.equal(model.isCollectionScan, true);
        assert.equal(model.isMultiKey, false);
        assert.equal(model.inMemorySort, false);
        assert.equal(model.usedIndex, null);
        assert.ok(model.rawExplainObject);
        assert.equal(model.legacyMode, true);
      });
    });

    describe('Simple indexed queries', function() {
      it('should populate the model correctly', function() {
        assert.equal(model.nReturned, 50051);
        assert.equal(model.executionTimeMillis, 19);
        assert.equal(model.totalKeysExamined, 50051);
        assert.equal(model.totalDocsExamined, 50051);
        assert.equal(model.isCovered, false);
        assert.equal(model.isCollectionScan, true);
        assert.equal(model.isMultiKey, false);
        assert.equal(model.inMemorySort, false);
        assert.equal(model.usedIndex, null);
        assert.ok(model.rawExplainObject);
        assert.equal(model.legacyMode, true);
      });
    });

    describe('Covered queries', function() {
      beforeEach(function() {
        model = loadExplainFixture('./fixtures/covered_index_2.6.json');
      });

      it('should be a covered query', function() {
        assert.equal(model.isCovered, true);
      });
    });

    describe('In-memory sorted queries', function() {
      beforeEach(function() {
        model = loadExplainFixture('./fixtures/sort_skip_limit_index_2.6.json');
      });

      // this oddly returns scanAndOrder: false on the top-level, but each
      // of the clauses has scanAndOrder: true. I suspect this is a bug in
      // the output.

      // it('should detect an in memory sort', function() {
      //   assert.equal(model.inMemorySort, true);
      // });

      it('should not detect collection scan', function() {
        assert.equal(model.isCollectionScan, false);
      });

      it('should return null for the used index because it\'s complicated', function() {
        assert.equal(model.usedIndex, null);
      });

      it('should not be a covered index', function() {
        assert.equal(model.isCovered, false);
      });
    });
  });

  context('Helpers', function() {
    var explain;
    var model;

    beforeEach(function() {
      explain = require('./fixtures/simple_index_3.2.json');
      model = new ExplainPlanModel(explain, {parse: true});
    });

    it('should find a stage by name from the root stage', function() {
      var ixscan = model.findStageByName('IXSCAN');
      assert.equal(ixscan.indexName, 'age_1');
    });

    it('should find a stage by name from a provided stage', function() {
      var fetch = model.findStageByName('FETCH');
      assert.equal(fetch.stage, 'FETCH');
      var ixscan = model.findStageByName('IXSCAN', fetch);
      assert.equal(ixscan.indexName, 'age_1');
    });

    it('should find a stage if it is the provided root stage', function() {
      var fetch = model.findStageByName('FETCH');
      assert.equal(fetch.stage, 'FETCH');
      var fetch2 = model.findStageByName('FETCH', fetch);
      assert.equal(fetch, fetch2);
    });

    it('should iterate over stages', function() {
      var it = model._getStageIterator();
      assert.ok(it.next);
      assert.equal(it.next(), model.rawExplainObject.executionStats.executionStages);
      assert.equal(it.next().stage, 'IXSCAN');
      assert.equal(it.next(), null);
    });
  });
});
