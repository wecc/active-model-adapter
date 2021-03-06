import setupStore from '../helpers/setup-store';
import ActiveModelAdapter from 'active-model-adapter';
import ActiveModelSerializer from 'active-model-adapter/active-model-serializer';
import Ember from 'ember';
import {module, test} from 'qunit';

var SuperVillain, EvilMinion, YellowMinion, DoomsdayDevice, MediocreVillain, env;
var run = Ember.run;

module("integration/active_model - AMS-namespaced-model-names", {
  beforeEach: function() {
    SuperVillain = DS.Model.extend({
      firstName:     DS.attr('string'),
      lastName:      DS.attr('string'),
      evilMinions:   DS.hasMany('evil-minion')
    });

    EvilMinion = DS.Model.extend({
      superVillain: DS.belongsTo('super-villain'),
      name:         DS.attr('string')
    });
    YellowMinion = EvilMinion.extend();
    DoomsdayDevice = DS.Model.extend({
      name:         DS.attr('string'),
      evilMinion:   DS.belongsTo('evil-minion', { polymorphic: true })
    });
    MediocreVillain = DS.Model.extend({
      name:         DS.attr('string'),
      evilMinions:  DS.hasMany('evil-minion', { polymorphic: true })
    });
    env = setupStore({
      superVillain:   SuperVillain,
      evilMinion:     EvilMinion,
      'evilMinions/yellowMinion':   YellowMinion,
      doomsdayDevice: DoomsdayDevice,
      mediocreVillain: MediocreVillain,
      yellowMinion: YellowMinion
    });
    env.store.modelFor('super-villain');
    env.store.modelFor('evil-minion');
    env.store.modelFor('evil-minions/yellow-minion');
    env.store.modelFor('doomsday-device');
    env.store.modelFor('mediocre-villain');
    env.registry.register('serializer:application', ActiveModelSerializer);
    env.registry.register('serializer:-active-model', ActiveModelSerializer);
    env.registry.register('adapter:-active-model', ActiveModelAdapter);
    env.amsSerializer = env.container.lookup("serializer:-active-model");
    env.amsAdapter    = env.container.lookup("adapter:-active-model");
  },

  afterEach: function() {
    run(env.store, 'destroy');
  }
});

test("serialize polymorphic", function(assert) {
  var tom, ray;
  run(function() {
    tom = env.store.createRecord('evil-minions/yellow-minion', { name: "Alex", id: "124" });
    ray = env.store.createRecord('doomsday-device', { evilMinion: tom, name: "DeathRay" });
  });

  var json = env.amsSerializer.serialize(ray._createSnapshot());

  assert.deepEqual(json, {
    name: "DeathRay",
    evil_minion_type: "EvilMinions::YellowMinion",
    evil_minion_id: "124"
  });
});

test("serialize polymorphic when type key is not camelized", function(assert) {
  YellowMinion.modelName = 'evil-minions/yellow-minion';
  var tom, ray;
  run(function() {
    tom = env.store.createRecord('yellow-minion', { name: "Alex", id: "124" });
    ray = env.store.createRecord('doomsday-device', { evilMinion: tom, name: "DeathRay" });
  });

  var json = env.amsSerializer.serialize(ray._createSnapshot());

  assert.deepEqual(json["evil_minion_type"], "EvilMinions::YellowMinion");
});

test("extractPolymorphic hasMany", function(assert) {
  var json_hash = {
    mediocre_villain: { id: 1, name: "Dr Horrible", evil_minions: [{ type: "EvilMinions::YellowMinion", id: 12 }] },
    evil_minions:    [{ id: 12, name: "Alex", doomsday_device_ids: [1] }]
  };
  var json;

  run(function() {
    json = env.amsSerializer.extractSingle(env.store, MediocreVillain, json_hash);
  });

  assert.deepEqual(json, {
    "id": 1,
    "name": "Dr Horrible",
    "evilMinions": [{
      type: "evil-minions/yellow-minion",
      id: 12
    }]
  });
});

test("extractPolymorphic", function(assert) {
  var json_hash = {
    doomsday_device: { id: 1, name: "DeathRay", evil_minion: { type: "EvilMinions::YellowMinion", id: 12 } },
    evil_minions:    [{ id: 12, name: "Alex", doomsday_device_ids: [1] }]
  };
  var json;

  run(function() {
    json = env.amsSerializer.extractSingle(env.store, DoomsdayDevice, json_hash);
  });

  assert.deepEqual(json, {
    "id": 1,
    "name": "DeathRay",
    "evilMinion": {
      type: "evil-minions/yellow-minion",
      id: 12
    }
  });
});
