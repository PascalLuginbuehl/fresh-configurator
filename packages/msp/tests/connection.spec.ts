import MockBinding from "@serialport/binding-mock";
import flushPromises from "flush-promises";
import { raw, reset, execute } from "../src/serial/connection";
import { open, connections, isOpen, ports, close } from "../src";
import { encodeMessageV1, encodeMessageV2 } from "../src/serial/encoders";

const mockPorts = ["/dev/something", "/dev/somethingelse"];

const writtenData = (port: string): Buffer =>
  (raw(port)?.binding as MockBinding).recording;

const reply = (port: string, data: Buffer): void => {
  (raw(port)?.binding as MockBinding).emitData(data);
};

beforeEach(() => {
  MockBinding.reset();
  reset();

  mockPorts.forEach(path => {
    MockBinding.createPort(path, { record: true });
  });
});

beforeEach(() => {
  jest.useRealTimers();
});

describe("open", () => {
  it("should open a serial connection to the given port", async () => {
    await open("/dev/something");
    expect(isOpen("/dev/something")).toBe(true);
  });

  it("should allow multiple ports to be opened", async () => {
    await Promise.all(mockPorts.map(port => open(port)));
    expect(mockPorts.every(port => isOpen(port))).toBe(true);
  });

  it("should provide a callback and close the connection when the connection closes", done => {
    open("/dev/something", () => {
      expect(isOpen("/dev/something")).toBe(false);
      done();
    }).then(() => raw("/dev/something")?.close());
  });

  it("should close the connection when an error occurs", done => {
    open("/dev/something", () => {
      expect(isOpen("/dev/something")).toBe(false);
      done();
    }).then(() =>
      raw("/dev/something")?.emit("error", new Error("Oh no some error"))
    );
  });

  it("should throw an error when port cannot be opened", async () => {
    await expect(open("/something/wrong")).rejects.toEqual(expect.any(Error));
    await expect(open("/something/wrong")).rejects.toMatchSnapshot();
  });

  it("should not allow a connection to be opened more than once", async () => {
    await open("/dev/something");
    await expect(open("/dev/something")).rejects.toEqual(expect.any(Error));
    await expect(open("/dev/something")).rejects.toMatchSnapshot();
  });
});

describe("connections", () => {
  it("should return a list of connected ports", async () => {
    expect(connections()).toEqual([]);
    await open("/dev/somethingelse");

    expect(connections()).toEqual(["/dev/somethingelse"]);

    await close("/dev/somethingelse");
    expect(connections()).toEqual([]);
  });
});

describe("close", () => {
  it("should close an open connection", async () => {
    const closeCallback = jest.fn();

    await open("/dev/something", closeCallback);
    await close("/dev/something");

    expect(isOpen("/dev/something")).toBe(false);
    expect(closeCallback).toHaveBeenCalled();
  });

  it("should ignore when connection is already closed", async () => {
    await expect(close("/dev/something")).resolves.toBeUndefined();
  });
});

describe("ports", () => {
  it("should list the available ports", async () => {
    expect(await ports()).toEqual(mockPorts);
  });
});

describe("execute", () => {
  it("should throw an error if the port is not open", async () => {
    await expect(execute("/dev/something", { code: 1 })).rejects.toEqual(
      expect.any(Error)
    );
    await expect(
      execute("/dev/something", { code: 1 })
    ).rejects.toMatchSnapshot();
  });

  it("should write the given command and data for v1 commands", async () => {
    await open("/dev/something");
    execute("/dev/something", {
      code: 254,
      data: Buffer.from("This is a message")
    });
    await flushPromises();

    expect(writtenData("/dev/something")).toEqual(
      encodeMessageV1(254, Buffer.from("This is a message"))
    );
  });

  it("should write the given command and data for v2 commands", async () => {
    await open("/dev/something");
    execute("/dev/something", {
      code: 255,
      data: Buffer.from("This is a v2 message")
    });
    await flushPromises();

    expect(writtenData("/dev/something")).toEqual(
      encodeMessageV2(255, Buffer.from("This is a v2 message"))
    );
  });

  it("should deduplicate requests, if the same request is already in flight", async () => {
    await open("/dev/something");
    execute("/dev/something", {
      code: 255,
      data: Buffer.from("This is a v2 message")
    });
    await flushPromises();
    execute("/dev/something", {
      code: 255,
      data: Buffer.from("This is a v2 message")
    });

    expect(writtenData("/dev/something")).toEqual(
      encodeMessageV2(255, Buffer.from("This is a v2 message"))
    );

    execute("/dev/something", {
      code: 255,
      data: Buffer.from("This is a different request")
    });
    await flushPromises();
    expect(writtenData("/dev/something")).toEqual(
      Buffer.concat([
        encodeMessageV2(255, Buffer.from("This is a v2 message")),
        encodeMessageV2(255, Buffer.from("This is a different request"))
      ])
    );
  });

  it("should return response of the given request", async () => {
    await open("/dev/something");
    const execution = execute("/dev/something", {
      code: 108
    });
    await flushPromises();

    // Reply the data in 2 parts to ensure that it can
    // handle data coming in chunks
    reply("/dev/something", Buffer.from([36, 77, 62, 6, 108]));
    await flushPromises();
    reply("/dev/something", Buffer.from([129, 0, 62, 1, 100, 1, 177]));

    const response = await execution;
    expect(Buffer.from(response.buffer())).toEqual(
      Buffer.from([129, 0, 62, 1, 100, 1])
    );
  });

  it("should ignore responses which are not related", async () => {
    await open("/dev/something");
    const execution = execute("/dev/something", {
      code: 108
    });
    await flushPromises();

    // write some data which is not the response
    reply("/dev/something", Buffer.from([36, 77, 62, 0, 100, 177]));
    await flushPromises();
    reply(
      "/dev/something",
      Buffer.from([36, 77, 62, 6, 108, 129, 0, 62, 1, 100, 1, 177])
    );
    await flushPromises();

    const response = await execution;
    expect(Buffer.from(response.buffer())).toEqual(
      Buffer.from([129, 0, 62, 1, 100, 1])
    );
  });

  it("should return the same data for a duplicate request", async () => {
    await open("/dev/something");
    const execution1 = execute("/dev/something", {
      code: 108
    });
    const execution2 = execute("/dev/something", {
      code: 108
    });

    await flushPromises();
    reply(
      "/dev/something",
      Buffer.from([36, 77, 62, 6, 108, 129, 0, 62, 1, 100, 1, 177])
    );

    const response1 = await execution1;
    expect(Buffer.from(response1.buffer())).toEqual(
      Buffer.from([129, 0, 62, 1, 100, 1])
    );

    const response2 = await execution2;
    expect(Buffer.from(response2.buffer())).toEqual(
      Buffer.from([129, 0, 62, 1, 100, 1])
    );

    // Ensure they are their own objects
    expect(response1).not.toBe(response2);
  });

  it("should ignore malformed responses", async () => {
    await open("/dev/something");

    jest.useFakeTimers();
    const execution = execute("/dev/something", {
      code: 108
    });

    // Invalid checksum
    reply(
      "/dev/something",
      Buffer.from([36, 77, 62, 6, 108, 129, 0, 62, 1, 100, 1, 232])
    );
    await flushPromises();

    jest.runAllTimers();
    // Should timeout from no response
    await expect(execution).rejects.toEqual(expect.any(Error));
  });

  it("should timeout after given timeout", async () => {
    await open("/dev/something");

    jest.useFakeTimers();

    let rejected: Error | undefined;
    execute("/dev/something", {
      code: 108,
      timeout: 500
    }).catch(err => {
      rejected = err;
    });

    // Advancing to 499 should not timeout
    jest.advanceTimersByTime(499);
    await flushPromises();
    expect(rejected).toBeFalsy();

    // but 500 should
    jest.advanceTimersByTime(1);
    await flushPromises();

    expect(rejected).toBeTruthy();
    expect(rejected).toMatchSnapshot();
  });
});
