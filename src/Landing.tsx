import { ConnectButton } from "@mysten/dapp-kit";
import { Button } from "@radix-ui/themes";

const Landing = () => {
  return (
    <div className="border border-[#d3d3d3] rounded-md px-20 py-5">
      <h2>Arctic</h2>
      <section className="flex flex-col items-center">
        <h1>Securely manager your passwords</h1>
        <p>Built on Sui, encrypted by Seal, stored on Walrus</p>
        <div className="flex flex-row">
            <ConnectButton />
            <Button>Enter the Igloo</Button>
        </div>
        <img src="/src/assets/img/igloo.png" width={600}/>
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
    </div>
  );
};

export default Landing;
