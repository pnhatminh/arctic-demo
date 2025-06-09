import { useMemo } from "react";

type WalrusService = {
  id: string;
  name: string;
  publisherUrl: string;
  aggregatorUrl: string;
};

interface UseWalrusServicesType {
  walrusServices: WalrusService[];
  getAggregatorUrl: (selectedService: string, path: string) => void;
  getPublisherUrl: (selectedService: string, path: string) => void;
}

export function UseWalrusServices(): UseWalrusServicesType {
  return useMemo(() => {
    const walrusServices = [
      {
        id: "service1",
        name: "walrus.space",
        publisherUrl: "/publisher1",
        aggregatorUrl: "/aggregator1",
      },
      {
        id: "service2",
        name: "staketab.org",
        publisherUrl: "/publisher2",
        aggregatorUrl: "/aggregator2",
      },
      {
        id: "service3",
        name: "redundex.com",
        publisherUrl: "/publisher3",
        aggregatorUrl: "/aggregator3",
      },
      {
        id: "service4",
        name: "nodes.guru",
        publisherUrl: "/publisher4",
        aggregatorUrl: "/aggregator4",
      },
      {
        id: "service5",
        name: "banansen.dev",
        publisherUrl: "/publisher5",
        aggregatorUrl: "/aggregator5",
      },
      {
        id: "service6",
        name: "everstake.one",
        publisherUrl: "/publisher6",
        aggregatorUrl: "/aggregator6",
      },
    ];
    return {
      walrusServices,
      getAggregatorUrl: (selectedService: string, path: string) => {
        const service = walrusServices.find((s) => s.id === selectedService);
        const cleanPath = path.replace(/^\/+/, "").replace(/^v1\//, "");
        return `${service?.aggregatorUrl}/v1/${cleanPath}`;
      },
      getPublisherUrl: (selectedService: string, path: string) => {
        const service = walrusServices.find((s) => s.id === selectedService);
        const cleanPath = path.replace(/^\/+/, "").replace(/^v1\//, "");
        return `${service?.publisherUrl}/v1/${cleanPath}`;
      },
    };
  }, []);
}
