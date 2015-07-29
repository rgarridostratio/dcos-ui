jest.dontMock("../NodesGridView");
jest.dontMock("../../mixins/InternalStorageMixin");
jest.dontMock("../../stores/MesosStateStore");

var React = require("react/addons");
var TestUtils = React.addons.TestUtils;

var NodesGridView = require("../NodesGridView");
var MesosStateStore = require("../../stores/MesosStateStore");

MesosStateStore.getLatest = function () {
  return {frameworks: []};
};

MesosStateStore.addChangeListener = function () {};

describe("NodesGridView", function () {

  describe("#getActiveServiceIds", function () {

    beforeEach(function () {
      this.hosts = [
        {
          name: "foo",
          framework_ids: [
            "a",
            "b",
            "c"
          ]
        },
        {
          name: "bar",
          framework_ids: [
            "a",
            "b",
            "c",
            "d",
            "e",
            "f"
          ]
        },
        {
          name: "zoo",
          framework_ids: [
            "a",
            "d",
            "g",
            "z"
          ]
        }
      ];

      this.instance = TestUtils.renderIntoDocument(
        <NodesGridView
          selectedResource={"mem"}
          hosts={this.hosts}
          services={[]}
          />
      );
    });

    it("should return a list of unique framwork_ids", function () {
      var list = this.instance.getActiveServiceIds(this.hosts);

      expect(list).toEqual(["a", "b", "c", "d", "e", "f", "g", "z"]);
    });

  });

});
