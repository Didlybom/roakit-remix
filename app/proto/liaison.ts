/**
 * Generated by the protoc-gen-ts.  DO NOT EDIT!
 * compiler version: 3.20.3
 * source: proto/liaison.proto
 * git: https://github.com/thesayyn/protoc-gen-ts */
import * as pb_1 from "google-protobuf";
export namespace liaison.v1 {
    export class ClientId extends pb_1.Message {
        #one_of_decls: number[][] = [];
        constructor(data?: any[] | {
            customerId?: number;
            feedId?: number;
            checksum?: string;
        }) {
            super();
            pb_1.Message.initialize(this, Array.isArray(data) ? data : [], 0, -1, [], this.#one_of_decls);
            if (!Array.isArray(data) && typeof data == "object") {
                if ("customerId" in data && data.customerId != undefined) {
                    this.customerId = data.customerId;
                }
                if ("feedId" in data && data.feedId != undefined) {
                    this.feedId = data.feedId;
                }
                if ("checksum" in data && data.checksum != undefined) {
                    this.checksum = data.checksum;
                }
            }
        }
        get customerId() {
            return pb_1.Message.getFieldWithDefault(this, 1, 0) as number;
        }
        set customerId(value: number) {
            pb_1.Message.setField(this, 1, value);
        }
        get feedId() {
            return pb_1.Message.getFieldWithDefault(this, 2, 0) as number;
        }
        set feedId(value: number) {
            pb_1.Message.setField(this, 2, value);
        }
        get checksum() {
            return pb_1.Message.getFieldWithDefault(this, 8, "") as string;
        }
        set checksum(value: string) {
            pb_1.Message.setField(this, 8, value);
        }
        static fromObject(data: {
            customerId?: number;
            feedId?: number;
            checksum?: string;
        }): ClientId {
            const message = new ClientId({});
            if (data.customerId != null) {
                message.customerId = data.customerId;
            }
            if (data.feedId != null) {
                message.feedId = data.feedId;
            }
            if (data.checksum != null) {
                message.checksum = data.checksum;
            }
            return message;
        }
        toObject() {
            const data: {
                customerId?: number;
                feedId?: number;
                checksum?: string;
            } = {};
            if (this.customerId != null) {
                data.customerId = this.customerId;
            }
            if (this.feedId != null) {
                data.feedId = this.feedId;
            }
            if (this.checksum != null) {
                data.checksum = this.checksum;
            }
            return data;
        }
        serialize(): Uint8Array;
        serialize(w: pb_1.BinaryWriter): void;
        serialize(w?: pb_1.BinaryWriter): Uint8Array | void {
            const writer = w || new pb_1.BinaryWriter();
            if (this.customerId != 0)
                writer.writeUint64(1, this.customerId);
            if (this.feedId != 0)
                writer.writeUint64(2, this.feedId);
            if (this.checksum.length)
                writer.writeString(8, this.checksum);
            if (!w)
                return writer.getResultBuffer();
        }
        static deserialize(bytes: Uint8Array | pb_1.BinaryReader): ClientId {
            const reader = bytes instanceof pb_1.BinaryReader ? bytes : new pb_1.BinaryReader(bytes), message = new ClientId();
            while (reader.nextField()) {
                if (reader.isEndGroup())
                    break;
                switch (reader.getFieldNumber()) {
                    case 1:
                        message.customerId = reader.readUint64();
                        break;
                    case 2:
                        message.feedId = reader.readUint64();
                        break;
                    case 8:
                        message.checksum = reader.readString();
                        break;
                    default: reader.skipField();
                }
            }
            return message;
        }
        serializeBinary(): Uint8Array {
            return this.serialize();
        }
        static deserializeBinary(bytes: Uint8Array): ClientId {
            return ClientId.deserialize(bytes);
        }
    }
}