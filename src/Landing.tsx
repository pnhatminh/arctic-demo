import { ConnectButton } from "@mysten/dapp-kit";
import { useNavigate } from "react-router-dom";
import { Card } from "./components/ui/card";
import { Button } from "./components/ui/button";

const Landing = () => {
  const navigate = useNavigate();
  return (
    <Card>
      <h2>Arctic</h2>
      <section className="flex flex-col items-center">
        <h1>Securely manage and share your credentials</h1>
        <p>Built on Sui, encrypted by Seal, stored on Walrus</p>
        <div className="flex flex-row">
          <ConnectButton />
          <Button variant="secondary" onClick={() => navigate("/vault")}>
            Enter the Igloo
          </Button>
        </div>
        <img src="/src/assets/img/igloo.png" width={600} />
        <div className="flex w-full">
          <div>
            <span>End-to-end Encryption</span>
          </div>
          <div>
            <span>Decentralize</span>
          </div>
          <div>
            <span>Open-source</span>
          </div>
        </div>
      </section>
    </Card>
  );
};

export default Landing;
