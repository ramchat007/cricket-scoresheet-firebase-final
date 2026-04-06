import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import ReactGA from "react-ga4";

export default function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    // Replace with your actual GA4 Measurement ID
    ReactGA.initialize("G-NGL0G335B2");
  }, []);

  useEffect(() => {
    // Send pageview with a custom path
    ReactGA.send({
      hitType: "pageview",
      page: location.pathname + location.search,
    });
  }, [location]);
}
