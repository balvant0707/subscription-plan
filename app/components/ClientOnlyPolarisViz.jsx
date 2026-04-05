import { useEffect, useState } from "react";

function EmptyChart({ minHeight = 280 }) {
  return <div style={{ minHeight: `${minHeight}px` }} />;
}

function ClientOnlyPolarisVizChart({ chartName, chartProps, minHeight }) {
  const [vizModule, setVizModule] = useState(null);

  useEffect(() => {
    let mounted = true;

    import("@shopify/polaris-viz")
      .then((module) => {
        if (mounted) {
          setVizModule(module);
        }
      })
      .catch(() => {
        if (mounted) {
          setVizModule({});
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!vizModule) {
    return <EmptyChart minHeight={minHeight} />;
  }

  const Chart = vizModule[chartName];
  const PolarisVizProvider = vizModule.PolarisVizProvider;

  if (!Chart || !PolarisVizProvider) {
    return <EmptyChart minHeight={minHeight} />;
  }

  return (
    <PolarisVizProvider>
      <Chart {...chartProps} />
    </PolarisVizProvider>
  );
}

export function ClientOnlyLineChart({ minHeight = 280, ...chartProps }) {
  return (
    <ClientOnlyPolarisVizChart
      chartName="LineChart"
      chartProps={chartProps}
      minHeight={minHeight}
    />
  );
}

export function ClientOnlySimpleBarChart({ minHeight = 280, ...chartProps }) {
  return (
    <ClientOnlyPolarisVizChart
      chartName="SimpleBarChart"
      chartProps={chartProps}
      minHeight={minHeight}
    />
  );
}
