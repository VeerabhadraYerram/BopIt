import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

function clone(value) {
  return structuredClone(value);
}

function activeOwner(subscription, installationId) {
  return subscription.owners.find(owner => owner.installationId === installationId && !owner.cancelledAt);
}

export function createSubscriptionStore(filePath) {
  let state;
  let queue = Promise.resolve();

  async function load() {
    if (state) return state;
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8'));
      if (!parsed || !Array.isArray(parsed.subscriptions) || !Array.isArray(parsed.events)) {
        throw new Error('Subscription storage has an invalid structure.');
      }
      state = parsed;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      state = { subscriptions: [], events: [] };
    }
    return state;
  }

  async function persist(next) {
    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${filePath}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      await writeFile(temporaryPath, JSON.stringify(next), { mode: 0o600, flag: 'wx' });
      await rename(temporaryPath, filePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => {});
      throw error;
    }
  }

  function transact(mutator, write = false) {
    const operation = queue.then(async () => {
      const current = await load();
      const next = clone(current);
      const result = mutator(next);
      if (write) await persist(next);
      state = next;
      return clone(result);
    });
    queue = operation.catch(() => {});
    return operation;
  }

  return {
    async findDuplicate(installationId, request) {
      return transact(current => current.subscriptions.find(subscription => {
        const owner = activeOwner(subscription, installationId);
        return owner && subscription.status === 'active'
          && subscription.requestedProductId === request.productId
          && JSON.stringify(subscription.events) === JSON.stringify(request.events)
          && JSON.stringify(subscription.domains || []) === JSON.stringify(request.domains || [])
          && JSON.stringify(subscription.variantSelection || []) === JSON.stringify(request.selection || []);
      }) || null);
    },

    async upsertSubscription(providerSubscription, request, installationId) {
      return transact(current => {
        const subscriptionId = providerSubscription.subscription_id;
        const providerEvents = [...providerSubscription.events].sort();
        const providerSelection = providerSubscription.selection || request.selection || [];
        const providerDomains = providerSubscription.domains || request.domains || [];
        let record = current.subscriptions.find(item => item.subscriptionId === subscriptionId);
        if (record) {
          if (record.requestedProductId !== request.productId
              || record.canonicalProductId !== providerSubscription.product_id
              || JSON.stringify(record.events) !== JSON.stringify(providerEvents)
              || JSON.stringify(record.variantSelection || []) !== JSON.stringify(providerSelection)
              || JSON.stringify(record.domains || []) !== JSON.stringify(providerDomains)) {
            throw new Error('Channel3 returned a subscription ID with conflicting scope.');
          }
          record.status = providerSubscription.status;
          record.createdAt = providerSubscription.created_at;
          record.cancelledAt = providerSubscription.status === 'cancelled'
            ? record.cancelledAt || new Date().toISOString() : null;
        } else {
          record = {
            subscriptionId,
            requestedProductId: request.productId,
            canonicalProductId: providerSubscription.product_id,
            variantSelection: providerSelection,
            events: providerEvents,
            domains: providerDomains,
            status: providerSubscription.status,
            createdAt: providerSubscription.created_at,
            cancelledAt: providerSubscription.status === 'cancelled' ? new Date().toISOString() : null,
            notificationDeliveryStatus: 'waiting-for-webhook',
            owners: []
          };
          current.subscriptions.push(record);
        }
        let owner = record.owners.find(item => item.installationId === installationId);
        if (!owner) {
          owner = { installationId, createdAt: new Date().toISOString(), cancelledAt: null };
          record.owners.push(owner);
        } else if (providerSubscription.status === 'active') {
          owner.cancelledAt = null;
        }
        return { ...record, ownerStatus: owner.cancelledAt ? 'cancelled' : record.status, ownerCancelledAt: owner.cancelledAt };
      }, true);
    },

    async getOwnedSubscription(subscriptionId, installationId) {
      return transact(current => {
        const record = current.subscriptions.find(item => item.subscriptionId === subscriptionId);
        const owner = record?.owners.find(item => item.installationId === installationId);
        return record && owner ? { ...record, ownerStatus: owner.cancelledAt ? 'cancelled' : record.status, ownerCancelledAt: owner.cancelledAt } : null;
      });
    },

    async listOwnedSubscriptions(installationId) {
      return transact(current => current.subscriptions.flatMap(record => {
        const owner = record.owners.find(item => item.installationId === installationId);
        return owner ? [{ ...record, ownerStatus: owner.cancelledAt ? 'cancelled' : record.status, ownerCancelledAt: owner.cancelledAt }] : [];
      }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },

    async activeOwnerCount(subscriptionId) {
      return transact(current => {
        const record = current.subscriptions.find(item => item.subscriptionId === subscriptionId);
        return record?.status === 'active' ? record.owners.filter(owner => !owner.cancelledAt).length : 0;
      });
    },

    async markOwnerCancelled(subscriptionId, installationId, providerSubscription = null) {
      return transact(current => {
        const record = current.subscriptions.find(item => item.subscriptionId === subscriptionId);
        const owner = record?.owners.find(item => item.installationId === installationId);
        if (!record || !owner) return null;
        owner.cancelledAt ||= new Date().toISOString();
        if (providerSubscription?.status === 'cancelled') {
          record.status = 'cancelled';
          record.cancelledAt ||= new Date().toISOString();
        }
        return { ...record, ownerStatus: 'cancelled', ownerCancelledAt: owner.cancelledAt };
      }, true);
    },

    async updateSubscription(providerSubscription) {
      return transact(current => {
        const record = current.subscriptions.find(item => item.subscriptionId === providerSubscription.subscription_id);
        if (!record) return null;
        record.status = providerSubscription.status;
        record.cancelledAt = providerSubscription.status === 'cancelled'
          ? record.cancelledAt || new Date().toISOString() : null;
        return record;
      }, true);
    },

    async persistWebhookEvent(event) {
      return transact(current => {
        if (current.events.some(item => item.eventId === event.id)) return { duplicate: true, recipients: 0 };
        const subscription = current.subscriptions.find(item => item.subscriptionId === event.data?.subscription_id);
        const recipients = subscription
          && subscription.canonicalProductId === event.data?.subject?.product_id
          && subscription.events.includes(event.type)
          ? subscription.owners.filter(owner => !owner.cancelledAt).map(owner => ({ installationId: owner.installationId, readAt: null }))
          : [];
        const record = {
          eventId: event.id,
          timestamp: event.timestamp,
          type: event.type,
          data: event.data,
          receivedAt: new Date().toISOString(),
          notificationDeliveryStatus: recipients.length ? 'persisted-inbox-not-pushed' : 'persisted-no-active-recipient',
          recipients
        };
        current.events.push(record);
        for (const id of new Set(recipients.map(item => item.installationId))) {
          const owner = subscription.owners.find(item => item.installationId === id);
          if (owner) owner.notificationDeliveryStatus = 'webhook-received';
        }
        return { duplicate: false, recipients: recipients.length, notificationDeliveryStatus: record.notificationDeliveryStatus };
      }, true);
    },

    async listEvents(installationId, limit = 100) {
      return transact(current => current.events.slice().reverse().flatMap(event => {
        const recipient = event.recipients.find(item => item.installationId === installationId);
        return recipient ? [{ ...event, recipients: undefined, read: Boolean(recipient.readAt) }] : [];
      }).slice(0, limit));
    },

    async markEventsRead(installationId, eventIds) {
      return transact(current => {
        let updated = 0;
        for (const event of current.events) {
          if (!eventIds.includes(event.eventId)) continue;
          const recipient = event.recipients.find(item => item.installationId === installationId);
          if (recipient && !recipient.readAt) { recipient.readAt = new Date().toISOString(); updated++; }
        }
        return { updated };
      }, true);
    }
  };
}
