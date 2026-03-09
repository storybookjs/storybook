import { useEffect, useState } from "react";
import { Data, fetchData } from "./ClearModuleMocks.api"

export const ClearModuleMocks = () => {

  const [data, setData] = useState<Data[]>([]);

  useEffect(() => {
    fetchData().then(data => setData(data));
  }, []);

  return <ul>
    {data.map((elm, idx) => <li key={idx}>{elm.title}</li>)}
  </ul>
}